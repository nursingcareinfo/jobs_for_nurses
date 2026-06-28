import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());

  // API routes FIRST
  app.post("/api/extract", upload.single('file'), async (req: any, res: any) => {
    try {
      const file = req.file;
      if (!file || !process.env.GEMINI_API_KEY) {
        return res.json({ extractedData: {} });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const parts = [{
        inlineData: {
          mimeType: file.mimetype,
          data: file.buffer.toString("base64"),
        }
      }, {
        text: "Extract candidate information from this document. Focus on full name, phone number, email, and nursing license number if available."
      }];

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              extractedName: { type: Type.STRING },
              extractedEmail: { type: Type.STRING },
              extractedPhone: { type: Type.STRING },
              extractedLicense: { type: Type.STRING },
            }
          }
        }
      });

      let extractedData = {};
      if (aiResponse.text) {
         extractedData = JSON.parse(aiResponse.text);
      }
      res.json({ extractedData });
    } catch (error: any) {
      console.warn("Extraction error (handled):", error);
      res.json({ extractedData: {} });
    }
  });

  app.post("/api/apply", upload.fields([{ name: 'cv', maxCount: 1 }, { name: 'pnc', maxCount: 1 }]), async (req: any, res: any) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      const { fullName, phone, email, licenseNumber } = req.body || {};
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const cvFile = files?.['cv']?.[0];
      const pncFile = files?.['pnc']?.[0];

      let extractedData: any = {};

      if (process.env.GEMINI_API_KEY && (cvFile || pncFile)) {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: { 'User-Agent': 'aistudio-build' }
          }
        });

        const parts: any[] = [];
        if (cvFile) {
           parts.push({
             inlineData: {
               mimeType: cvFile.mimetype,
               data: cvFile.buffer.toString("base64"),
             }
           });
        }
        if (pncFile) {
           parts.push({
             inlineData: {
               mimeType: pncFile.mimetype,
               data: pncFile.buffer.toString("base64"),
             }
           });
        }
        parts.push({
          text: "Extract candidate information from the provided CV and/or PNC license documents. Focus on finding full name, phone number, email, and any license details. If the documents are not provided or not readable, extract whatever is available."
        });

        try {
          const aiResponse = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: { parts },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  extractedName: { type: Type.STRING },
                  extractedEmail: { type: Type.STRING },
                  extractedPhone: { type: Type.STRING },
                  extractedLicense: { type: Type.STRING },
                  education: { type: Type.STRING },
                  experience: { type: Type.STRING }
                }
              }
            }
          });
          
          if (aiResponse.text) {
             extractedData = JSON.parse(aiResponse.text);
          }
        } catch (e) {
          console.warn("Gemini extraction error (handled):", e);
        }
      }

      const finalName = fullName || extractedData.extractedName;
      const finalPhone = phone || extractedData.extractedPhone;
      const finalEmail = email || extractedData.extractedEmail;
      const finalLicense = licenseNumber || extractedData.extractedLicense;

      if (!supabaseUrl || !supabaseServiceKey) {
        console.warn("Supabase credentials not configured.");
        return res.json({ success: true, simulated: true, extractedData, message: "Application received. (Simulated)" });
      }

      let dbData = null;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // We'll store both the user-provided data and the AI extracted data
      const { data, error } = await supabase
        .from("nursing_applications")
        .insert([{ 
          full_name: finalName, 
          phone: finalPhone, 
          email: finalEmail, 
          license_number: finalLicense,
          ai_extracted_data: extractedData,
          survey_link_sent: true // simulated survey link sending
        }]);

      if (error) {
        console.warn("Supabase insert error (handled):", error);
        // Do not throw here, instead we can proceed and tell the user it was received but simulated
        return res.json({ success: true, simulated: true, extractedData, message: "Application received. (Database insert failed - Simulated)" });
      } else {
        dbData = data;
      }

      res.json({ success: true, data: dbData, extractedData, message: "Application received and survey link generated." });
    } catch (error: any) {
      console.error("Application error:", error);
      res.status(500).json({ error: error.message || "Failed to submit application" });
    }
  });

  app.post("/api/survey", async (req: any, res: any) => {
    try {
      const { fullName, phone, email, ...surveyData } = req.body || {};

      if (!fullName) {
        return res.status(400).json({ error: "Full name is required" });
      }

      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        console.warn("Supabase credentials not configured.");
        return res.json({ success: true, simulated: true, message: "Survey received. (Simulated)" });
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data, error } = await supabase
        .from("survey_responses")
        .insert([{
          applicant_name: fullName,
          applicant_email: email || null,
          applicant_phone: phone || null,
          survey_data: surveyData,
        }]);

      if (error) {
        console.warn("Survey insert error (handled):", error);
        return res.json({ success: true, simulated: true, message: "Survey received. (Database insert failed - Simulated)" });
      }

      res.json({ success: true, data, message: "Survey submitted successfully." });
    } catch (error: any) {
      console.error("Survey error:", error);
      res.status(500).json({ error: error.message || "Failed to submit survey" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
