import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShieldCheck, FileText, BadgeCheck, UploadCloud, CheckCircle2, Globe2 } from 'lucide-react';

export default function Hero() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [cvName, setCvName] = useState<string | null>(null);
  const [licenseName, setLicenseName] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [email, setEmail] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  const [address, setAddress] = useState('');
  const [languages, setLanguages] = useState('');
  const [education, setEducation] = useState('');
  const [experience, setExperience] = useState('');
  const [skills, setSkills] = useState('');
  const [certifications, setCertifications] = useState('');

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>, type: 'cv' | 'pnc') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'cv') setCvName(file.name);
    if (type === 'pnc') setLicenseName(file.name);

    setIsExtracting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.extractedData) {
        const ed = data.extractedData;
        if (ed.extractedName && !name) setName(ed.extractedName);
        if (ed.extractedEmail && !email) setEmail(ed.extractedEmail);
        if (ed.extractedLicense && !licenseNumber) setLicenseNumber(ed.extractedLicense);
        if (ed.extractedPhone && !phone) {
          let val = ed.extractedPhone.replace(/\D/g, '');
          if (val.startsWith('92')) val = val.substring(2);
          else if (val.startsWith('0')) val = val.substring(1);
          let formatted = '+92';
          if (val.length > 0) formatted += ' ' + val.substring(0, 3);
          if (val.length > 3) formatted += ' ' + val.substring(3, 10);
          setPhone(formatted);
        }
        if (ed.extractedAddress && !address) setAddress(ed.extractedAddress);
        if (ed.extractedLanguages && !languages) setLanguages(ed.extractedLanguages);
        if (ed.extractedEducation && !education) setEducation(ed.extractedEducation);
        if (ed.extractedExperience && !experience) setExperience(ed.extractedExperience);
        if (ed.extractedSkills && !skills) setSkills(ed.extractedSkills);
        if (ed.extractedCertifications && !certifications) setCertifications(ed.extractedCertifications);


      }
    } catch (err) {
      console.error("Extraction error:", err);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    formData.set('fullName', name);
    formData.set('phone', phone);
    formData.set('email', email);
    formData.set('licenseNumber', licenseNumber);
    formData.set('address', address);
    formData.set('languages', languages);
    formData.set('education', education);
    formData.set('experience', experience);
    formData.set('skills', skills);
    formData.set('certifications', certifications);

    try {
      const response = await fetch('/api/apply', {
        method: 'POST',
        body: formData, // Send the FormData directly
      });

      if (!response.ok) {
        throw new Error('Failed to submit application');
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned an invalid response. Please try again.");
      }

      const resData = await response.json();

      setIsSuccess(true);
      setExtractedData(resData?.extractedData || null);
      form.reset();
      setCvName(null);
      setLicenseName(null);
      setName('');
      setPhone('');
      setAddress('');
      setLanguages('');
      setEducation('');
      setExperience('');
      setSkills('');
      setCertifications('');
    } catch (error) {
      console.error('Submission error:', error);
      alert('There was an error submitting your application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="apply-form" className="relative pt-24 sm:pt-32 pb-16 sm:pb-20 lg:pt-40 lg:pb-32 overflow-hidden bg-[#080a0f] min-h-screen flex items-center">
      {/* Background decoration */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-5%] left-[-5%] w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
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
            
            <h1 className="text-3xl sm:text-5xl lg:text-7xl font-serif font-light text-white leading-tight mb-6">
              Your Nursing Career, <br/>
              <span className="italic font-normal text-white">Across Borders.</span>
            </h1>
            
            <p className="text-base sm:text-lg text-slate-400 mb-8 leading-relaxed max-w-lg">
              We are actively hiring qualified nurses for premier medical facilities worldwide. Upload your CV and PNC License below for an immediate interview schedule.
            </p>

            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-8 text-2xl sm:text-3xl">
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
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-10">
              <img src="https://images.unsplash.com/photo-1584432810601-6c7f27d2362b?auto=format&fit=crop&q=80&w=600&h=400" className="w-full h-24 sm:h-32 lg:h-40 rounded-xl sm:rounded-2xl border border-white/10 object-cover grayscale opacity-80 hover:grayscale-0 transition-all duration-500 cursor-pointer" alt="Nurse working" />
              <img src="https://images.unsplash.com/photo-1576091160550-2173ff9e5eb3?auto=format&fit=crop&q=80&w=600&h=400" className="w-full h-24 sm:h-32 lg:h-40 rounded-xl sm:rounded-2xl border border-white/10 object-cover grayscale opacity-80 hover:grayscale-0 transition-all duration-500 cursor-pointer" alt="Nurse with patient" />
              <img src="https://images.unsplash.com/photo-1581056771107-24ca5f463cd5?auto=format&fit=crop&q=80&w=600&h=400" className="w-full h-24 sm:h-32 lg:h-40 rounded-xl sm:rounded-2xl border border-white/10 object-cover grayscale opacity-80 hover:grayscale-0 transition-all duration-500 cursor-pointer hidden sm:block" alt="Nurse team" />
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

            {/* Nurses Image Row */}
            <div className="flex items-center gap-4">
              <div className="flex -space-x-4">
                <img src="https://images.unsplash.com/photo-1584432810601-6c7f27d2362b?auto=format&fit=crop&q=80&w=100&h=100" className="w-12 h-12 rounded-full border-2 border-[#080a0f] object-cover grayscale opacity-80" alt="Nurse" />
                <img src="https://images.unsplash.com/photo-1576091160550-2173ff9e5eb3?auto=format&fit=crop&q=80&w=100&h=100" className="w-12 h-12 rounded-full border-2 border-[#080a0f] object-cover grayscale opacity-80" alt="Nurse" />
                <img src="https://images.unsplash.com/photo-1581056771107-24ca5f463cd5?auto=format&fit=crop&q=80&w=100&h=100" className="w-12 h-12 rounded-full border-2 border-[#080a0f] object-cover grayscale opacity-80" alt="Nurse" />
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-tight">
                Join 5,000+ Nurses<br/>Placed Globally
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
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl">
              {isSuccess ? (
                <div className="text-center py-8">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-20 h-20 bg-brand-500/20 border border-brand-500/30 rounded-full flex items-center justify-center mx-auto mb-6"
                  >
                    <CheckCircle2 className="w-10 h-10 text-brand-400" />
                  </motion.div>
                  <h3 className="text-2xl font-serif text-white mb-2">Application Received!</h3>
                  <p className="text-slate-400 mb-6 text-sm">We've successfully processed your documents. <br/> A survey link has been generated based on your profile.</p>
                  
                    {extractedData && Object.keys(extractedData).length > 0 && (
                    <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-left mb-8 max-h-96 overflow-y-auto">
                      <h4 className="text-[10px] text-brand-400 uppercase tracking-widest font-bold mb-3 border-b border-white/5 pb-2">AI Extracted Details</h4>
                      <ul className="space-y-2 text-sm text-slate-300">
                        {extractedData.extractedName && <li><strong className="text-slate-500">Name:</strong> {extractedData.extractedName}</li>}
                        {extractedData.extractedEmail && <li><strong className="text-slate-500">Email:</strong> {extractedData.extractedEmail}</li>}
                        {extractedData.extractedPhone && <li><strong className="text-slate-500">Phone:</strong> {extractedData.extractedPhone}</li>}
                        {extractedData.extractedLicense && <li><strong className="text-slate-500">License:</strong> {extractedData.extractedLicense}</li>}
                        {extractedData.extractedAddress && <li><strong className="text-slate-500">Address:</strong> {extractedData.extractedAddress}</li>}
                        {extractedData.extractedLanguages && <li><strong className="text-slate-500">Languages:</strong> {extractedData.extractedLanguages}</li>}
                        {extractedData.extractedEducation && <li><strong className="text-slate-500">Education:</strong> {extractedData.extractedEducation}</li>}
                        {extractedData.extractedExperience && <li><strong className="text-slate-500">Experience:</strong> {extractedData.extractedExperience}</li>}
                        {extractedData.extractedSkills && <li><strong className="text-slate-500">Skills:</strong> {extractedData.extractedSkills}</li>}
                        {extractedData.extractedCertifications && <li><strong className="text-slate-500">Certifications:</strong> {extractedData.extractedCertifications}</li>}
                      </ul>
                    </div>
                  )}

                  <Link 
                    to="/survey"
                    state={{ extractedData }}
                    className="inline-flex justify-center items-center bg-brand-500 text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-brand-400 transition-colors w-full mb-4"
                  >
                    Complete Required Survey
                  </Link>
                  
                  <button 
                    onClick={() => setIsSuccess(false)}
                    className="bg-white/5 text-slate-300 px-8 py-3 rounded-xl font-bold hover:bg-white/10 transition-colors w-full text-sm"
                  >
                    Submit Another Application
                  </button>
                </div>
              ) : (
                <div>
                  <h3 className="text-2xl font-serif text-white mb-2">Instant Application</h3>
                  <p className="text-sm text-slate-500 mb-8">Upload your CV and PNC License — we'll extract everything automatically.</p>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
                      <div className="relative cursor-pointer group">
                        <input 
                          type="file" 
                          name="cv" required
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                          onChange={(e) => handleFileUpload(e, 'cv')}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                        />
                        <div className={`border-2 border-dashed rounded-xl p-3 flex flex-col items-center justify-center transition-colors h-24 ${cvName ? 'border-brand-500/50 bg-brand-500/10' : 'border-white/5 bg-white/0 group-hover:bg-white/5'}`}>
                          <FileText className={`w-5 h-5 mx-auto mb-1 ${cvName ? 'text-brand-400' : 'text-slate-500 group-hover:text-brand-400'}`} />
                          <p className="text-[10px] font-bold text-slate-400 truncate w-full text-center">{cvName || "Upload CV / Resume"}</p>
                          <p className="text-[9px] text-slate-600 mt-1">{cvName ? "Ready" : "PDF, DOCX or Image"}</p>
                        </div>
                      </div>

                      <div className="relative cursor-pointer group">
                        <input 
                          type="file" 
                          name="pnc"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileUpload(e, 'pnc')}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                        />
                        <div className={`border-2 border-dashed rounded-xl p-3 flex flex-col items-center justify-center transition-colors h-24 ${licenseName ? 'border-brand-500/50 bg-brand-500/10' : 'border-white/5 bg-white/0 group-hover:bg-white/5'}`}>
                          <BadgeCheck className={`w-5 h-5 mx-auto mb-1 ${licenseName ? 'text-brand-400' : 'text-slate-500 group-hover:text-brand-400'}`} />
                          <p className="text-[10px] font-bold text-slate-400 truncate w-full text-center">{licenseName || "PNC License"}</p>
                          <p className="text-[9px] text-slate-600 mt-1">{licenseName ? "Ready" : "Photo or PDF"}</p>
                        </div>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={isSubmitting || isExtracting}
                      className="w-full bg-brand-500 hover:bg-brand-400 text-slate-900 font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex justify-center items-center gap-2 mt-4 shadow-lg shadow-brand-500/20 disabled:opacity-70 disabled:transform-none"
                    >
                      {isSubmitting || isExtracting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                          <span>{isExtracting ? "Extracting Data..." : "Submitting..."}</span>
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
            </div>
          </motion.div>
          
        </div>
      </div>
    </section>
  );
}
