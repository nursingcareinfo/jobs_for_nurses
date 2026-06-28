import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShieldCheck, FileText, BadgeCheck, UploadCloud, CheckCircle2, Globe2, ArrowRight } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function formatPhone(val: string | null): string {
  if (!val) return '';
  let digits = val.replace(/\D/g, '');
  if (digits.startsWith('92')) digits = digits.substring(2);
  else if (digits.startsWith('0')) digits = digits.substring(1);
  if (!digits.length) return '';
  let formatted = '+92';
  if (digits.length > 0) formatted += ' ' + digits.substring(0, 3);
  if (digits.length > 3) formatted += ' ' + digits.substring(3, 10);
  return formatted;
}

export default function Hero() {
  const navigate = useNavigate();

  // Flow: 'form' | 'extracting' | 'welcome' | 'submitting' | 'success'
  const [flowState, setFlowState] = useState<'form' | 'extracting' | 'welcome' | 'submitting' | 'success'>('form');
  const [extractedData, setExtractedData] = useState<any>(null);
  const [pncFile, setPncFile] = useState<File | null>(null);
  const [pncFileName, setPncFileName] = useState<string | null>(null);

  // Form fields (pre-filled from AI extraction)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pncNumber, setPncNumber] = useState('');
  const [pncExpiry, setPncExpiry] = useState('');
  const [cnic, setCnic] = useState('');

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const words = e.target.value.split(' ');
    const capitalized = words.map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
    setName(capitalized);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.startsWith('92')) val = val.substring(2);
    else if (val.startsWith('0')) val = val.substring(1);
    if (val.length === 0) { setPhone(''); return; }
    let formatted = '+92';
    if (val.length > 0) formatted += ' ' + val.substring(0, 3);
    if (val.length > 3) formatted += ' ' + val.substring(3, 10);
    setPhone(formatted);
  };

  const handlePncUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 4MB limit to avoid edge function body size issues with base64
    if (file.size > 4 * 1024 * 1024) {
      alert('File is too large. Please upload a PNC image under 4MB.');
      return;
    }

    setPncFile(file);
    setPncFileName(file.name);
    setFlowState('extracting');

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = (reader.result as string).split(',')[1]; // strip data:...;base64 prefix

      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/extract-info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Data, mimeType: file.type }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Extraction failed (${res.status})`);
        }

        const data = await res.json();
        if (data.success && data.data) {
          const d = data.data;
          setName(d.extractedName || '');
          setPncNumber(d.extractedPncNumber || '');
          setPncExpiry(d.extractedPncExpiry || '');
          setPhone(formatPhone(d.extractedPhone));
          setEmail(d.extractedEmail || '');
          setCnic(d.extractedCnic || '');
          setExtractedData(d);
          setFlowState('welcome');
        } else {
          throw new Error(data.error || 'Extraction returned no usable data');
        }
      } catch (err) {
        console.error('Extraction error:', err);
        alert('Failed to extract data from the PNC image. Please try a clearer photo.');
        setFlowState('form');
        setPncFile(null);
        setPncFileName(null);
      }
    };
    reader.onerror = () => {
      alert('Failed to read the file. Please try again.');
      setFlowState('form');
      setPncFile(null);
      setPncFileName(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !pncNumber) {
      alert('Full name and PNC license number are required.');
      return;
    }

    setFlowState('submitting');

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: name,
          phone: phone || null,
          email: email || null,
          pncNumber,
          pncExpiry: pncExpiry || null,
          cnic: cnic || null,
          aiExtractedData: extractedData,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Submission failed (${res.status})`);
      }

      const data = await res.json();
      if (data.success) {
        setFlowState('success');
      } else {
        throw new Error(data.error || 'Submission failed');
      }
    } catch (err) {
      console.error('Submission error:', err);
      alert('There was an error submitting your application. Please try again.');
      setFlowState('welcome');
    }
  };

  const goToSurvey = () => {
    navigate('/survey', {
      state: {
        applicantName: name,
        applicantPhone: phone,
        applicantEmail: email,
        extractedData,
      },
    });
  };

  const resetForm = () => {
    setFlowState('form');
    setExtractedData(null);
    setPncFile(null);
    setPncFileName(null);
    setName('');
    setPhone('');
    setEmail('');
    setPncNumber('');
    setPncExpiry('');
    setCnic('');
  };

  return (
    <section id="apply-form" className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden bg-[#080a0f] min-h-screen flex items-center">
      {/* Background decoration */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-5%] left-[-5%] w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-start">

          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 pr-0 lg:pr-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 font-bold text-[10px] uppercase tracking-widest mb-6">
              <Globe2 size={14} />
              <span>Hiring Nurses for 10+ Countries</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-serif font-light text-white leading-tight mb-6">
              Your Nursing Career, <br />
              <span className="italic font-normal text-white">Across Borders.</span>
            </h1>

            <p className="text-lg text-slate-400 mb-8 leading-relaxed max-w-lg">
              We are actively hiring qualified nurses for premier medical facilities worldwide. Upload your PNC License below for an immediate interview schedule.
            </p>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-8 text-3xl">
              <span title="United States">🇺🇸</span>
              <span title="United Kingdom">🇬🇧</span>
              <span title="Canada">🇨🇦</span>
              <span title="Australia">🇦🇺</span>
              <span title="Ireland">🇮🇪</span>
              <span title="Germany">🇩🇪</span>
              <span title="Saudi Arabia">🇸🇦</span>
              <span title="UAE">🇦🇪</span>
              <span title="Qatar">🇶🇦</span>
              <span title="Oman">🇴🇲</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2 flex items-center h-full pt-1">+ More</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
              <img src="https://images.unsplash.com/photo-1584432810601-6c7f27d2362b?auto=format&fit=crop&q=80&w=600&h=400" className="w-full h-32 sm:h-40 rounded-2xl border border-white/10 object-cover grayscale opacity-80 hover:grayscale-0 transition-all duration-500 cursor-pointer" alt="Nurse working" />
              <img src="https://images.unsplash.com/photo-1576091160550-2173ff9e5eb3?auto=format&fit=crop&q=80&w=600&h=400" className="w-full h-32 sm:h-40 rounded-2xl border border-white/10 object-cover grayscale opacity-80 hover:grayscale-0 transition-all duration-500 cursor-pointer" alt="Nurse with patient" />
              <img src="https://images.unsplash.com/photo-1581056771107-24ca5f463cd5?auto=format&fit=crop&q=80&w=600&h=400" className="w-full h-32 sm:h-40 rounded-2xl border border-white/10 object-cover grayscale opacity-80 hover:grayscale-0 transition-all duration-500 cursor-pointer hidden sm:block" alt="Nurse team" />
            </div>

            <div className="bg-brand-500/10 border border-brand-500/20 rounded-2xl p-6 mb-10 max-w-lg">
              <div className="flex items-start gap-4">
                <div className="bg-brand-500/20 p-2 rounded-lg text-brand-400 shrink-0">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-white font-serif text-xl mb-1">Zero Upfront Costs</h3>
                  <p className="text-sm text-slate-400">No payments in advance. The company will pay everything including flights, visas, and initial housing.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex -space-x-4">
                <img src="https://images.unsplash.com/photo-1584432810601-6c7f27d2362b?auto=format&fit=crop&q=80&w=100&h=100" className="w-12 h-12 rounded-full border-2 border-[#080a0f] object-cover grayscale opacity-80" alt="Nurse" />
                <img src="https://images.unsplash.com/photo-1576091160550-2173ff9e5eb3?auto=format&fit=crop&q=80&w=100&h=100" className="w-12 h-12 rounded-full border-2 border-[#080a0f] object-cover grayscale opacity-80" alt="Nurse" />
                <img src="https://images.unsplash.com/photo-1581056771107-24ca5f463cd5?auto=format&fit=crop&q=80&w=100&h=100" className="w-12 h-12 rounded-full border-2 border-[#080a0f] object-cover grayscale opacity-80" alt="Nurse" />
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-tight">
                Join 5,000+ Nurses<br />Placed Globally
              </div>
            </div>
          </motion.div>

          {/* Application Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="lg:col-span-5 w-full"
          >
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl">

              {/* STATE: Extracting */}
              {flowState === 'extracting' && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 border-4 border-brand-500/30 border-t-brand-400 rounded-full animate-spin mx-auto mb-6" />
                  <h3 className="text-xl font-serif text-white mb-2">Reading Your PNC License...</h3>
                  <p className="text-sm text-slate-400">AI is extracting your details from the uploaded image.</p>
                  {pncFileName && (
                    <p className="text-xs text-slate-500 mt-4">{pncFileName}</p>
                  )}
                </div>
              )}

              {/* STATE: Welcome — extracted, show form */}
              {(flowState === 'welcome' || flowState === 'submitting') && (
                <div>
                  {/* Welcome Banner */}
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-brand-500/15 border border-brand-500/25 rounded-2xl p-5 mb-6 text-center"
                  >
                    <h3 className="text-2xl font-serif text-white mb-1">
                      Welcome, {name || 'Nurse'}! 👋
                    </h3>
                    <p className="text-sm text-slate-400">Your PNC license was verified successfully.</p>
                  </motion.div>

                  {/* Extracted Data Summary */}
                  {extractedData && (
                    <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 mb-6">
                      <h4 className="text-[10px] text-brand-400 uppercase tracking-widest font-bold mb-3 border-b border-white/5 pb-2">AI Extracted Details</h4>
                      <dl className="space-y-1.5 text-sm">
                        {extractedData.extractedName && (
                          <div className="flex justify-between"><dt className="text-slate-500">Name</dt><dd className="text-white">{extractedData.extractedName}</dd></div>
                        )}
                        {extractedData.extractedPncNumber && (
                          <div className="flex justify-between"><dt className="text-slate-500">PNC #</dt><dd className="text-white font-mono">{extractedData.extractedPncNumber}</dd></div>
                        )}
                        {extractedData.extractedPncExpiry && (
                          <div className="flex justify-between"><dt className="text-slate-500">PNC Expiry</dt><dd className="text-white">{extractedData.extractedPncExpiry}</dd></div>
                        )}
                        {extractedData.extractedPhone && (
                          <div className="flex justify-between"><dt className="text-slate-500">Phone</dt><dd className="text-white">{extractedData.extractedPhone}</dd></div>
                        )}
                        {extractedData.extractedEmail && (
                          <div className="flex justify-between"><dt className="text-slate-500">Email</dt><dd className="text-white">{extractedData.extractedEmail}</dd></div>
                        )}
                        {extractedData.extractedCnic && (
                          <div className="flex justify-between"><dt className="text-slate-500">CNIC</dt><dd className="text-white font-mono">{extractedData.extractedCnic}</dd></div>
                        )}
                      </dl>
                    </div>
                  )}

                  {/* Application Form */}
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-2">Full Name <span className="text-brand-400">*</span></label>
                      <input required name="fullName" value={name} onChange={handleNameChange} type="text" className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors placeholder:text-slate-600" placeholder="John Doe" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-2">Phone</label>
                        <input name="phone" value={phone} onChange={handlePhoneChange} type="tel" className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors placeholder:text-slate-600" placeholder="+92 3XX XXXXXXX" />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-2">Email <span className="text-slate-600 font-normal lowercase tracking-normal">(optional)</span></label>
                        <input name="email" value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors placeholder:text-slate-600" placeholder="nurse@example.com" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-2">PNC License # <span className="text-brand-400">*</span></label>
                        <input required name="pncNumber" value={pncNumber} onChange={e => setPncNumber(e.target.value)} type="text" className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors placeholder:text-slate-600" placeholder="PN-XXXXXXX" />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-2">PNC Expiry</label>
                        <input name="pncExpiry" value={pncExpiry} onChange={e => setPncExpiry(e.target.value)} type="text" className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors placeholder:text-slate-600" placeholder="YYYY-MM-DD" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-2">CNIC Number</label>
                      <input name="cnic" value={cnic} onChange={e => setCnic(e.target.value)} type="text" className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors placeholder:text-slate-600" placeholder="XXXXX-XXXXXXX-X" />
                    </div>

                    <button
                      type="submit"
                      disabled={flowState === 'submitting'}
                      className="w-full bg-brand-500 hover:bg-brand-400 text-slate-900 font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex justify-center items-center gap-2 mt-4 shadow-lg shadow-brand-500/20 disabled:opacity-70 disabled:transform-none"
                    >
                      {flowState === 'submitting' ? (
                        <>
                          <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <UploadCloud size={18} />
                          Submit Application
                        </>
                      )}
                    </button>

                    <p className="text-center text-[9px] text-slate-600 mt-4 uppercase tracking-widest">
                      Secure • Confidential • Worldwide
                    </p>
                  </form>
                </div>
              )}

              {/* STATE: Success — application submitted */}
              {flowState === 'success' && (
                <div className="text-center py-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-20 h-20 bg-brand-500/20 border border-brand-500/30 rounded-full flex items-center justify-center mx-auto mb-6"
                  >
                    <CheckCircle2 className="w-10 h-10 text-brand-400" />
                  </motion.div>
                  <h3 className="text-2xl font-serif text-white mb-2">Application Submitted!</h3>
                  <p className="text-slate-400 mb-6 text-sm">Your information has been saved. Please complete the required survey to finalize your application.</p>

                  <button
                    onClick={goToSurvey}
                    className="inline-flex justify-center items-center bg-brand-500 text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-brand-400 transition-colors w-full mb-4 gap-2"
                  >
                    Complete Required Survey
                    <ArrowRight size={18} />
                  </button>

                  <button
                    onClick={resetForm}
                    className="bg-white/5 text-slate-300 px-8 py-3 rounded-xl font-bold hover:bg-white/10 transition-colors w-full text-sm"
                  >
                    Submit Another Application
                  </button>
                </div>
              )}

              {/* STATE: Initial form — PNC upload + manual entry */}
              {flowState === 'form' && (
                <div>
                  <h3 className="text-2xl font-serif text-white mb-2">Instant Application</h3>
                  <p className="text-sm text-slate-500 mb-6">Upload your PNC License to auto-fill your details.</p>

                  {/* PNC Upload — MANDATORY, always visible in form state */}
                  <div className="mb-6">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-3">
                      PNC License Image <span className="text-brand-400">* Required</span>
                    </label>
                    <div className="relative cursor-pointer group">
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        onChange={handlePncUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        required
                      />
                      <div className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-colors ${pncFileName ? 'border-brand-500/50 bg-brand-500/10' : 'border-white/10 bg-white/[0.02] group-hover:bg-white/5'}`}>
                        <BadgeCheck className={`w-8 h-8 mx-auto mb-2 ${pncFileName ? 'text-brand-400' : 'text-slate-500 group-hover:text-brand-400'}`} />
                        <p className="text-sm font-bold text-slate-300">{pncFileName || "Tap to upload PNC License"}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{pncFileName ? "Tap to change" : "JPG, PNG or PDF — max 4MB"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Manual entry option */}
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-2">Full Name <span className="text-brand-400">*</span></label>
                      <input required name="fullName" value={name} onChange={handleNameChange} type="text" className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors placeholder:text-slate-600" placeholder="John Doe" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-2">Phone <span className="text-brand-400">*</span></label>
                        <input required name="phone" value={phone} onChange={handlePhoneChange} type="tel" className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors placeholder:text-slate-600" placeholder="+92 3XX XXXXXXX" />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-2">Email <span className="text-slate-600 font-normal lowercase tracking-normal">(optional)</span></label>
                        <input name="email" value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors placeholder:text-slate-600" placeholder="nurse@example.com" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-2">PNC License # <span className="text-brand-400">*</span></label>
                        <input required name="pncNumber" value={pncNumber} onChange={e => setPncNumber(e.target.value)} type="text" className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors placeholder:text-slate-600" placeholder="PN-XXXXXXX" />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-2">PNC Expiry</label>
                        <input name="pncExpiry" value={pncExpiry} onChange={e => setPncExpiry(e.target.value)} type="text" className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors placeholder:text-slate-600" placeholder="YYYY-MM-DD" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-2">CNIC Number <span className="text-brand-400">*</span></label>
                      <input required name="cnic" value={cnic} onChange={e => setCnic(e.target.value)} type="text" className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors placeholder:text-slate-600" placeholder="XXXXX-XXXXXXX-X" />
                    </div>

                    <button
                      type="submit"
                      disabled={flowState === 'submitting'}
                      className="w-full bg-brand-500 hover:bg-brand-400 text-slate-900 font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex justify-center items-center gap-2 mt-4 shadow-lg shadow-brand-500/20 disabled:opacity-70 disabled:transform-none"
                    >
                      <UploadCloud size={18} />
                      Submit Application
                    </button>

                    <p className="text-center text-[9px] text-slate-600 mt-4 uppercase tracking-widest">
                      Secure • Confidential • Worldwide
                    </p>
                  </form>
                </div>
              )}

            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
