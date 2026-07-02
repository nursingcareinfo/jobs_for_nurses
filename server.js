// server.ts
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";

// lib/ocr.ts
import { PaddleOcrService } from "ppu-paddle-ocr";
var ocrService = null;
async function getOcrService() {
  if (!ocrService) {
    ocrService = new PaddleOcrService({
      debugging: { verbose: false }
    });
    await ocrService.initialize();
  }
  return ocrService;
}
async function extractTextFromImage(buffer) {
  const service = await getOcrService();
  const arrayBuf = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
  const result = await service.recognize(arrayBuf, { flatten: true });
  return result.results.map((r) => r.text.trim()).filter(Boolean).join("\n");
}
async function destroyOcrService() {
  if (ocrService) {
    await ocrService.destroy();
    ocrService = null;
  }
}

// lib/parse-ocr.ts
function parseOcrText(rawText) {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const result = {};
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
  for (const line of lines) {
    const match = line.match(emailRegex);
    if (match) {
      result.extractedEmail = match[0].toLowerCase();
      break;
    }
  }
  const phoneRegex = /(?:\+?92[\s-]?|0)(?:3\d{2})[\s-]?\d{1}[\s-]?\d{3}[\s-]?\d{3}|\+?92[\s-]?\d{10}|\b0\d{10}\b|\+92\s\d{3}\s\d{7,8}/;
  for (const line of lines) {
    const cleaned = line.replace(/[-\s]/g, "");
    const match = line.match(phoneRegex);
    if (match) {
      let phone = match[0].trim();
      const digits = phone.replace(/\D/g, "");
      if (digits.length === 10 && digits.startsWith("3")) {
        phone = "+92 " + digits.substring(0, 3) + " " + digits.substring(3);
      } else if (digits.length === 12 && digits.startsWith("92")) {
        phone = "+" + digits.substring(0, 2) + " " + digits.substring(2, 5) + " " + digits.substring(5);
      } else if (digits.length === 11 && digits.startsWith("03")) {
        phone = "+92 " + digits.substring(2, 5) + " " + digits.substring(5);
      }
      result.extractedPhone = phone;
      break;
    }
  }
  const licenseRegex = /\b(?:PNC|P\.N\.C)[-:\s]*\d{4,6}\b|\b\d{4,6}[-:\s]?(?:PNC|P\.N\.C)\b/i;
  for (const line of lines) {
    const match = line.match(licenseRegex);
    if (match) {
      const cleaned = match[0].replace(/[.\s]/g, "").toUpperCase();
      const digits = cleaned.replace(/\D/g, "");
      if (digits) {
        result.extractedLicense = `PNC-${digits}`;
      } else {
        result.extractedLicense = match[0].trim();
      }
      break;
    }
  }
  if (!result.extractedLicense) {
    for (const line of lines) {
      if (/license|licence|pnc|registration/i.test(line)) {
        const digits = line.replace(/\D/g, "");
        if (digits.length >= 4 && digits.length <= 8) {
          result.extractedLicense = `PNC-${digits}`;
          break;
        }
      }
    }
  }
  const skipPatterns = [
    /^(address|phone|email|license|pnc|name|date|dob|gender|city|country|cnic|qualification|experience|institution|signature|page|form|application|council|registration|certificate|republic|islamabad|pakistan|government|ministry|department|board|hospital|college|university)/i,
    /^\d+[\s.]/,
    // numbered items
    /^[A-Z\s]{10,}$/,
    // ALL CAPS (likely headers)
    /^[a-z]/,
    // starts lowercase (unlikely name)
    /^(•|-|\*|✓|□|☐)/,
    // bullet points
    /\d{4}[-/]\d{2}[-/]\d{2}/,
    // dates
    /\b[A-Za-z0-9._%+-]+@/,
    // already extracted email
    /\+?92/,
    // already extracted phone
    /PNC[-:\s]?\d/
    // already extracted license
  ];
  for (const line of lines) {
    const nameMatch = line.match(/(?:Name|Full Name|Candidate)[:\s]+(.+)/i);
    if (nameMatch) {
      const potentialName = nameMatch[1].trim();
      if (potentialName.length > 3 && !/\d/.test(potentialName)) {
        result.extractedName = capitalizeName(potentialName);
        break;
      }
    }
  }
  if (!result.extractedName) {
    for (const line of lines) {
      const trimmed = line.replace(/^[\d\s.]+/, "").trim();
      if (trimmed.length > 4 && trimmed.length < 50 && !skipPatterns.some((p) => p.test(trimmed)) && /^[A-Za-z\s.\-']+$/.test(trimmed) && // only alphabetic chars
      trimmed.split(/\s+/).length >= 2) {
        result.extractedName = capitalizeName(trimmed);
        break;
      }
    }
  }
  return result;
}
function capitalizeName(name) {
  return name.split(/\s+/).map((word) => {
    if (word.length === 0) return word;
    return word.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join("-");
  }).join(" ");
}

// lib/extract-cv.ts
var pdfParseModule = null;
async function getPdfParse() {
  if (!pdfParseModule) {
    pdfParseModule = await import("pdf-parse");
  }
  return pdfParseModule;
}
var mammothModule = null;
async function getMammoth() {
  if (!mammothModule) {
    mammothModule = await import("mammoth");
  }
  return mammothModule.default || mammothModule;
}
function isPdf(buffer) {
  return buffer[0] === 37 && buffer[1] === 80 && buffer[2] === 68 && buffer[3] === 70;
}
function isDocx(buffer) {
  return buffer[0] === 80 && buffer[1] === 75;
}
function isPng(buffer) {
  return buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71;
}
function isJpeg(buffer) {
  return buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
}
async function extractTextFromCv(buffer, mimeType) {
  if (isPdf(buffer)) {
    return extractPdfText(buffer);
  }
  if (isDocx(buffer)) {
    return extractDocxText(buffer);
  }
  if (isPng(buffer) || isJpeg(buffer)) {
    const text = await extractTextFromImage(buffer);
    return { text, sourceType: "image" };
  }
  if (mimeType) {
    if (mimeType === "application/pdf") {
      return extractPdfText(buffer);
    }
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || mimeType === "application/msword") {
      return extractDocxText(buffer);
    }
    if (mimeType.startsWith("image/")) {
      const text = await extractTextFromImage(buffer);
      return { text, sourceType: "image" };
    }
  }
  try {
    return await extractPdfText(buffer);
  } catch {
    try {
      return await extractDocxText(buffer);
    } catch {
      const text = await extractTextFromImage(buffer);
      return { text, sourceType: "image" };
    }
  }
}
async function extractPdfText(buffer) {
  const mod = await getPdfParse();
  const { PDFParse, VerbosityLevel } = mod;
  const parser = new PDFParse({
    verbosity: VerbosityLevel.ERRORS,
    data: new Uint8Array(buffer)
  });
  const result = await parser.getText();
  const text = result.text || "";
  parser.destroy();
  return { text, sourceType: "pdf" };
}
async function extractDocxText(buffer) {
  const mammoth = await getMammoth();
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value || "", sourceType: "docx" };
}

// lib/parse-cv.ts
function parseCvText(rawText) {
  const result = {};
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  result.rawText = rawText.substring(0, 5e3);
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
  for (const line of lines) {
    const match = line.match(emailRegex);
    if (match) {
      result.extractedEmail = match[0].toLowerCase();
      break;
    }
  }
  const phoneRegex = /(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4,}/;
  for (const line of lines) {
    const match = line.match(phoneRegex);
    if (match) {
      let phone = match[0].trim();
      const digits = phone.replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 13) {
        if (digits.startsWith("92") && digits.length === 12) {
          phone = "+" + digits.substring(0, 2) + " " + digits.substring(2, 5) + " " + digits.substring(5);
        } else if (digits.startsWith("0") && digits.length === 11) {
          phone = "+92 " + digits.substring(2, 5) + " " + digits.substring(5);
        }
        result.extractedPhone = phone;
        break;
      }
    }
  }
  const licenseRegex = /\b(?:PNC|P\.N\.C|Pakistan Nursing Council)[-:\s]*(?:No[.:]?\s*)?(\d{4,8})\b/i;
  for (const line of lines) {
    const match = line.match(licenseRegex);
    if (match) {
      const digits = match[1] || match[0].replace(/\D/g, "");
      if (digits.length >= 4 && digits.length <= 8) {
        result.extractedLicense = `PNC-${digits}`;
        break;
      }
    }
  }
  if (!result.extractedLicense) {
    for (const line of lines) {
      if (/license|licence|pnc|registration/i.test(line)) {
        const digits = line.replace(/\D/g, "");
        if (digits.length >= 4 && digits.length <= 8) {
          result.extractedLicense = `PNC-${digits}`;
          break;
        }
      }
    }
  }
  const skipPatterns = [
    /^(address|phone|email|license|pnc|name|date|dob|gender|city|country|cnic|qualification|experience|institution|signature|page|form|application|council|registration|certificate|republic|islamabad|pakistan|government|ministry|department|board|hospital|college|university|curriculum|vitae|resume|cv|summary|profile|objective|education|skills|experience|work|employment|references|languages|interests|hobbies)/i,
    /^\d+[\s.]/,
    /^[A-Z\s]{10,}$/,
    /^[a-z]/,
    /^(•|-|\*|✓|□|☐)/,
    /\d{4}[-/]\d{2}[-/]\d{2}/,
    /\b[A-Za-z0-9._%+-]+@/,
    /\+?\d{7,}/,
    /PNC[-:\s]?\d/
  ];
  for (const line of lines) {
    const nameMatch = line.match(/(?:Name|Full Name|Candidate)[:\s]+(.+)/i);
    if (nameMatch) {
      const potentialName = nameMatch[1].trim();
      if (potentialName.length > 3 && !/\d/.test(potentialName)) {
        result.extractedName = potentialName;
        break;
      }
    }
  }
  if (!result.extractedName) {
    for (const line of lines.slice(0, 10)) {
      const trimmed = line.replace(/^[\d\s.]+/, "").trim();
      if (trimmed.length > 3 && trimmed.length < 50 && !skipPatterns.some((p) => p.test(trimmed)) && /^[A-Za-z\s.\-']+$/.test(trimmed) && trimmed.split(/\s+/).length >= 2) {
        result.extractedName = trimmed;
        break;
      }
    }
  }
  const addressPatterns = [
    /address[:\s]+(.+)/i,
    /located at[:\s]+(.+)/i,
    /residence[:\s]+(.+)/i
  ];
  for (const line of lines) {
    for (const pattern of addressPatterns) {
      const match = line.match(pattern);
      if (match && match[1].trim().length > 5) {
        result.extractedAddress = match[1].trim();
        break;
      }
    }
    if (result.extractedAddress) break;
  }
  if (!result.extractedAddress) {
    const cityKeywords = /karachi|lahore|islamabad|rawalpindi|peshawar|quetta|multan|faisalabad|gujranwala|hyderabad|sialkot/i;
    for (const line of lines) {
      if (cityKeywords.test(line) && /\d{4,5}/.test(line) && line.length > 10) {
        result.extractedAddress = line;
        break;
      }
    }
  }
  const dobRegex = /\b(?:DOB|Date of Birth|Birth Date|Born)[:\s]+(.+?)(?:\n|$)/i;
  const dobMatch = rawText.match(dobRegex);
  if (dobMatch) {
    const dob = dobMatch[1].trim();
    if (dob.length > 3 && /\d/.test(dob)) {
      result.extractedDob = dob;
    }
  }
  const nationalityRegex = /\b(?:Nationality|Citizenship)[:\s]+(.+?)(?:\n|$)/i;
  const natMatch = rawText.match(nationalityRegex);
  if (natMatch) {
    const nat = natMatch[1].trim();
    if (nat.length > 2 && nat.length < 50) {
      result.extractedNationality = nat;
    }
  }
  const langSection = extractSection(rawText, [
    /languages?/i,
    /linguistic/i
  ]);
  if (langSection) {
    result.extractedLanguages = langSection.split("\n").map((l) => l.replace(/^[•\-*\d.\s]+/, "").trim()).filter((l) => l.length > 0 && !/^(languages?|linguistic)/i.test(l)).slice(0, 8).join(", ");
  }
  const eduSection = extractSection(rawText, [
    /education/i,
    /academic background/i,
    /qualifications?/i,
    /training/i
  ]);
  if (eduSection) {
    const eduLines = eduSection.split("\n").map((l) => l.trim()).filter(Boolean);
    const significant = eduLines.filter((l) => {
      const lower = l.toLowerCase();
      return /\b(bsn|msn|rn|diploma|bachelor|master|degree|university|college|institute|school|phd|dnp|bs|ma|ms|bba|mba|bsc|msc)\b/i.test(
        lower
      ) && !/^(education|qualification|training)/i.test(lower);
    }).slice(0, 5);
    if (significant.length > 0) {
      result.extractedEducation = significant.join("; ");
    }
  }
  const expSection = extractSection(rawText, [
    /(?:work\s+)?experience/i,
    /employment/i,
    /professional\s+background/i,
    /career/i
  ]);
  if (expSection) {
    const expLines = expSection.split("\n").map((l) => l.trim()).filter(Boolean);
    const significant = expLines.filter((l) => {
      const lower = l.toLowerCase();
      return l.length > 15 && !/^(experience|work|employment|professional)/i.test(lower) && !/^(•|-|\*)/.test(l);
    }).slice(0, 8);
    if (significant.length > 0) {
      result.extractedExperience = significant.join("; ");
    }
  }
  const skillsSection = extractSection(rawText, [
    /skills?/i,
    /competenc/i,
    /proficienc/i,
    /expertise/i
  ]);
  if (skillsSection) {
    const skillLines = skillsSection.split("\n").map(
      (l) => l.replace(/^[•\-*\d.\s]+/, "").replace(/\s*\(.*?\)\s*/g, "").trim()
    ).filter((l) => l.length > 2 && !/^skills?$/i.test(l)).slice(0, 20);
    if (skillLines.length > 0) {
      result.extractedSkills = skillLines.join(", ");
    }
  }
  const certSection = extractSection(rawText, [
    /certificat/i,
    /professional\s+membership/i,
    /credential/i
  ]);
  if (certSection) {
    const certLines = certSection.split("\n").map(
      (l) => l.replace(/^[•\-*\d.\s]+/, "").trim()
    ).filter(
      (l) => l.length > 5 && !/^certificat/i.test(l) && !/^license/i.test(l)
    ).slice(0, 8);
    if (certLines.length > 0) {
      const filtered = certLines.filter(
        (c) => !result.extractedLicense || !c.includes("PNC")
      );
      if (filtered.length > 0) {
        result.extractedCertifications = filtered.join("; ");
      }
    }
  }
  if (expSection) {
    const expLines = expSection.split("\n").filter(Boolean);
    for (const line of expLines.slice(0, 5)) {
      const trimmed = line.replace(/^[•\-*\d.\s]+/, "").trim();
      if (trimmed.length > 10 && !/^(experience|work)/i.test(trimmed) && /[A-Z]/.test(trimmed) && /\d{4}/.test(trimmed)) {
        result.extractedCurrentEmployer = trimmed;
        break;
      }
    }
  }
  return result;
}
function extractSection(text, patterns) {
  const lines = text.split("\n");
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (patterns.some((p) => p.test(line))) {
      startIdx = i + 1;
      break;
    }
  }
  if (startIdx === -1 || startIdx >= lines.length) return null;
  const sectionHeaders = /^(education|experience|skills?|certification|references|training|projects|publications|awards|languages|interests|volunteer|summary|objective|profile)$/i;
  const sectionLines = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length > 0 && line.length < 60 && (sectionHeaders.test(line) || /^[A-Z\s]{4,}$/.test(line) && line.length > 3)) {
      if (patterns.some((p) => p.test(line))) continue;
      break;
    }
    sectionLines.push(line);
  }
  const result = sectionLines.filter(Boolean).join("\n").trim();
  return result.length > 0 ? result : null;
}

// server.ts
var ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/png",
  "image/jpeg"
];
var upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
    // 10MB limit per file (OCR needs room)
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, DOCX, PNG, JPEG`));
    }
  }
});
async function startServer() {
  const app = express();
  const PORT = 3e3;
  app.use(express.json());
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });
  app.post("/api/extract", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.json({ extractedData: {} });
      }
      const { text } = await extractTextFromCv(file.buffer, file.mimetype);
      const ocrData = parseOcrText(text);
      const cvData = parseCvText(text);
      const mergedData = { ...ocrData, ...cvData };
      res.json({ extractedData: mergedData });
    } catch (error) {
      console.warn("Extraction error (handled):", error);
      res.json({ extractedData: {} });
    }
  });
  app.post("/api/apply", upload.fields([{ name: "cv", maxCount: 1 }, { name: "pnc", maxCount: 1 }]), async (req, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const { fullName, phone, email, licenseNumber } = req.body || {};
      const files = req.files;
      const cvFile = files?.["cv"]?.[0];
      const pncFile = files?.["pnc"]?.[0];
      let extractedData = {};
      if (cvFile || pncFile) {
        const texts = [];
        if (cvFile) {
          const { text } = await extractTextFromCv(cvFile.buffer, cvFile.mimetype);
          texts.push(text);
        }
        if (pncFile) {
          const text = await extractTextFromImage(pncFile.buffer);
          texts.push(text);
        }
        const combinedText = texts.join("\n---\n");
        const ocrData = parseOcrText(combinedText);
        const cvData = parseCvText(combinedText);
        extractedData = { ...ocrData, ...cvData };
      }
      const finalName = fullName || extractedData.extractedName;
      const finalPhone = phone || extractedData.extractedPhone;
      const finalEmail = email || extractedData.extractedEmail;
      const finalLicense = licenseNumber || extractedData.extractedLicense;
      if (!supabaseUrl || !supabaseUrl.startsWith("http")) {
        console.warn("Supabase URL not configured or invalid.");
        return res.json({ success: true, simulated: true, extractedData, message: "Application received. (Simulated \u2014 Supabase not configured)" });
      }
      if (!supabaseServiceKey || supabaseServiceKey.length < 10 || /^your_|^MY_/i.test(supabaseServiceKey)) {
        console.warn("Supabase service role key not configured or invalid.");
        return res.json({ success: true, simulated: true, extractedData, message: "Application received. (Simulated \u2014 Supabase not configured)" });
      }
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data, error } = await supabase.from("nursing_applications").insert([{
        full_name: finalName,
        phone: finalPhone,
        email: finalEmail,
        license_number: finalLicense,
        address: extractedData.extractedAddress,
        languages: extractedData.extractedLanguages,
        education: extractedData.extractedEducation,
        experience: extractedData.extractedExperience,
        skills: extractedData.extractedSkills,
        certifications: extractedData.extractedCertifications,
        ai_extracted_data: extractedData,
        survey_link_sent: true
      }]).select("id").single();
      if (error) {
        console.warn("Supabase insert error (handled):", error);
        return res.json({ success: true, simulated: true, extractedData, message: "Application received. (Database insert failed - Simulated)" });
      }
      res.json({ success: true, extractedData, applicationId: data?.id, message: "Application received and survey link generated." });
    } catch (error) {
      console.error("Application error:", error);
      const message = error instanceof Error ? error.message : "Failed to submit application";
      res.status(500).json({ error: message });
    }
  });
  app.post("/api/survey", async (req, res) => {
    try {
      const surveyData = req.body?.surveyData || {};
      const extracted = req.body?.extractedData || {};
      const applicationId = req.body?.applicationId || null;
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseUrl.startsWith("http")) {
        console.warn("Supabase not configured \u2014 survey simulated.");
        return res.json({ success: true, simulated: true });
      }
      if (!supabaseServiceKey || supabaseServiceKey.length < 10 || /^your_|^MY_/i.test(supabaseServiceKey)) {
        console.warn("Supabase not configured \u2014 survey simulated.");
        return res.json({ success: true, simulated: true });
      }
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { error: insertError } = await supabase.from("survey_responses").insert([{ survey_data: surveyData, extracted_data: extracted, application_id: applicationId, submitted_at: (/* @__PURE__ */ new Date()).toISOString() }]);
      if (insertError) {
        console.warn("Survey insert error (handled):", insertError);
        return res.json({ success: true, simulated: true });
      }
      res.json({ success: true, id: null });
    } catch (error) {
      console.error("Survey submission error:", error);
      const message = error instanceof Error ? error.message : "Failed to submit survey";
      res.status(500).json({ error: message });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.use((err, req, res, _next) => {
    console.error("Global error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
  process.on("SIGTERM", async () => {
    await destroyOcrService();
    process.exit(0);
  });
  process.on("SIGINT", async () => {
    await destroyOcrService();
    process.exit(0);
  });
}
startServer();
//# sourceMappingURL=server.js.map
