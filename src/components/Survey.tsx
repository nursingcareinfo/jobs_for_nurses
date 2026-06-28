import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

import './Survey.css';

export default function Survey() {
  const location = useLocation();
  const { applicantName, applicantPhone, applicantEmail, extractedData: routeExtracted } = location.state || {};
  const extractedData = routeExtracted || {};

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Initial progress update to account for pre-filled data
    setTimeout(updateProgress, 100);
  }, []);

  const updateProgress = () => {
    // Basic progress calculation
    const inputs = document.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], input[type="date"], select');
    let filled = 0;
    inputs.forEach((input: any) => {
      if (input.value) filled++;
    });
    
    const scaleActive = document.querySelectorAll('.scale-btn.active').length;
    const total = 10; // rough estimate
    const pct = Math.round(Math.min(100, ((filled + scaleActive) / total) * 100));
    setProgress(pct);
  };

  const collectSurveyData = () => {
    const sections = document.querySelectorAll('.section');
    const body = (idx: number) => sections[idx]?.querySelector('.section-body');

    // Helper: read a single text/select/textarea field by label prefix
    const fv = (sectionBody: Element | null | undefined, labelPrefix: string): string => {
      if (!sectionBody) return '';
      const fields = sectionBody.querySelectorAll('.field');
      for (const field of fields) {
        const label = field.querySelector('label');
        if (label && label.textContent?.trim().startsWith(labelPrefix)) {
          const el = field.querySelector('input:not([type="radio"]):not([type="checkbox"]), select, textarea') as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
          return el?.value ?? '';
        }
      }
      return '';
    };

    // Helper: read checked radio label text (returns the .radio-label text of the checked input in a container)
    const radioVal = (container: Element, name: string): string => {
      const checked = container.querySelector(`input[type="radio"][name="${name}"]:checked`);
      if (!checked) return '';
      const item = checked.closest('.radio-item');
      return item?.querySelector('.radio-label')?.textContent?.trim() ?? '';
    };

    // Helper: collect checked checkbox label texts
    const checkedLabels = (container: Element): string[] => {
      const result: string[] = [];
      container.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        const item = cb.closest('.check-item');
        const lbl = item?.querySelector('.check-label');
        if (lbl?.textContent) result.push(lbl.textContent.trim());
      });
      return result;
    };

    // Helper: collect selected tag button texts
    const selectedTags = (container: Element): string[] => {
      const result: string[] = [];
      container.querySelectorAll('.tag-btn.selected').forEach(btn => {
        if (btn.textContent) result.push(btn.textContent.trim());
      });
      return result;
    };

    // Helper: read scale (1-5) value
    const scaleVal = (container: Element, scaleId: string): number | null => {
      const scaleRow = container.querySelector(`#${scaleId}`);
      if (!scaleRow) return null;
      const active = scaleRow.querySelector('.scale-btn.active');
      if (!active) return null;
      return parseInt(active.textContent || '0', 10) || null;
    };

    const s1 = body(0);
    const personal = {
      fullName: fv(s1, 'Full name'),
      gender: fv(s1, 'Gender'),
      dateOfBirth: fv(s1, 'Date of birth'),
      cnicNumber: fv(s1, 'CNIC number'),
      phone: fv(s1, 'Mobile number'),
      whatsappNumber: fv(s1, 'WhatsApp number'),
      email: fv(s1, 'Email address'),
      city: fv(s1, 'City of residence'),
      area: fv(s1, 'Area'),
      transport: fv(s1, 'Do you own a vehicle'),
    };

    // --- Section 2: PNC license & credentials ---
    const s2 = body(1);
    const credentials = {
      pncLicenseNumber: fv(s2, 'PNC license number'),
      pncLicenseExpiry: fv(s2, 'PNC license expiry'),
      qualification: fv(s2, 'Professional qualification'),
      specializations: s2 ? selectedTags(s2) : [],
      yearsExperience: fv(s2, 'Total years of experience'),
      homeNursingExperience: fv(s2, 'Experience in home nursing'),
      institutions: fv(s2, 'Name of institution'),
    };

    // --- Section 3: Employment & income ---
    const s3 = body(2);
    const employment = {
      status: s3 ? radioVal(s3, 'emp') : '',
      monthlyIncome: fv(s3, 'Average monthly income'),
      supplementalIncome: s3 ? radioVal(s3, 'supp') : '',
      supplementalIncomeAmount: fv(s3, 'If yes'),
      expectedShiftPay: fv(s3, 'how much would you expect'),
    };

    // --- Section 4: Availability & preferences ---
    const s4 = body(3);
    const availability = {
      weeklyHours: fv(s4, 'How many hours'),
      shifts: s4 ? checkedLabels(s4.querySelector('.check-group')!) : [],
      travelWillingness: fv(s4, 'willing to travel'),
      transitionWillingness: s4 ? radioVal(s4, 'transition') : '',
      patientPreferences: s4 ? checkedLabels(s4.querySelectorAll('.check-group')[1] as HTMLElement) : [],
    };

    // --- Section 5: Safety ---
    const s5 = body(4);
    const safety = {
      comfortLevel: s5 ? scaleVal(s5, 'scale1') : null,
      challenges: s5 ? checkedLabels(s5.querySelectorAll('.check-group')[0] as HTMLElement) : [],
      concerns: s5 ? checkedLabels(s5.querySelectorAll('.check-group')[1] as HTMLElement) : [],
      platformSafety: s5 ? radioVal(s5, 'safer') : '',
      safetyNotes: fv(s5, 'describe any specific incident'),
    };

    // --- Section 6: App viability ---
    const s6 = body(5);
    const viability = {
      platformAwareness: s6 ? radioVal(s6, 'aware') : '',
      findingWorkChannels: s6 ? checkedLabels(s6.querySelectorAll('.check-group')[0] as HTMLElement) : [],
      viabilityRating: s6 ? scaleVal(s6, 'scale2') : null,
      importantFeatures: s6 ? checkedLabels(s6.querySelectorAll('.check-group')[1] as HTMLElement) : [],
      recommendationRating: s6 ? scaleVal(s6, 'scale3') : null,
      adoptionBarrier: fv(s6, 'single biggest barrier'),
    };

    // --- Section 7: Final remarks ---
    const s7 = body(6);
    const finalRemarks = {
      additionalNotes: fv(s7, 'anything else'),
      followupConsent: s7 ? radioVal(s7, 'followup') : '',
    };

    return {
      fullName: personal.fullName,
      phone: personal.phone,
      email: personal.email,
      extractedData,
      personal,
      credentials,
      employment,
      availability,
      safety,
      viability,
      finalRemarks,
    };
  };

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

  const handleSubmit = async () => {
    const consent = document.getElementById('consentCheck') as HTMLInputElement;
    if (!consent?.checked) {
      if (consent?.parentElement) {
        consent.parentElement.style.outline = '2px solid #D85A30';
        consent.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const payload = collectSurveyData();

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to submit survey');
      }

      setIsSubmitted(true);
    } catch (error) {
      console.error('Survey submission error:', error);
      alert('There was an error submitting your survey. Please try again.');
    }
  };

  const toggleTag = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.toggle('selected');
  };

  const setScale = (e: React.MouseEvent<HTMLButtonElement>) => {
    const parent = e.currentTarget.parentElement;
    if (parent) {
      parent.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
    }
    e.currentTarget.classList.add('active');
    updateProgress();
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#080a0f] flex items-center justify-center p-4">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl max-w-md w-full text-center">
          <div className="w-20 h-20 bg-brand-500/20 border border-brand-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-brand-400" />
          </div>
          <h3 className="text-2xl font-serif text-white mb-2">Survey Submitted</h3>
          <p className="text-slate-400 mb-8 text-sm">Thank you for your feedback. We will be in touch shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="survey-container bg-[#f9fafb] min-h-screen py-10 px-4 flex justify-center text-left">
      <div className="form-wrap w-full">
        <h2 className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
          Nurse registration and viability survey form
        </h2>

        <div className="hero">
          <span className="badge badge-teal">H.M.S.P Nurse Survey 2026</span>
          <div className="hero-title">Home Nursing Platform — Nurse Registration & Viability Survey</div>
          <div className="hero-sub">This survey is for Registered Nurses in Pakistan. Your responses will help us build a better home nursing platform tailored to your needs. All data is kept strictly confidential and used only for product research. Estimated time: 8–12 minutes.</div>
        </div>

        <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }}></div></div>

        <div className="section">
          <div className="section-header">
            <div className="section-num">1</div>
            <div className="section-title">Personal information</div>
          </div>
          <div className="section-body">
            <div className="field-row">
              <div className="field">
                <label>Full name <span className="req">*</span></label>
                <input type="text" placeholder="As on CNIC / PNC license" defaultValue={applicantName || extractedData.extractedName || ''} onChange={updateProgress} />
              </div>
              <div className="field">
                <label>Gender <span className="req">*</span></label>
                <select onChange={updateProgress}>
                  <option value="">Select</option>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Prefer not to say</option>
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Date of birth <span className="req">*</span></label>
                <input type="date" onChange={updateProgress} />
              </div>
              <div className="field">
                <label>CNIC number <span className="req">*</span></label>
                <input type="text" placeholder="XXXXX-XXXXXXX-X" maxLength={15} onChange={updateProgress} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Mobile number <span className="req">*</span></label>
                <input type="tel" placeholder="+92 3XX XXXXXXX" defaultValue={applicantPhone || extractedData.extractedPhone || ''} onChange={updateProgress} />
              </div>
              <div className="field">
                <label>WhatsApp number</label>
                <input type="tel" placeholder="Same as mobile or different" onChange={updateProgress} />
              </div>
            </div>
            <div className="field">
              <label>Email address</label>
              <input type="email" placeholder="optional but recommended" defaultValue={applicantEmail || extractedData.extractedEmail || ''} onChange={updateProgress} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>City of residence <span className="req">*</span></label>
                <select onChange={updateProgress}>
                  <option value="">Select city</option>
                  <option>Karachi</option>
                  <option>Lahore</option>
                  <option>Islamabad</option>
                  <option>Rawalpindi</option>
                  <option>Peshawar</option>
                  <option>Quetta</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="field">
                <label>Area / neighbourhood <span className="req">*</span></label>
                <input type="text" placeholder="e.g. DHA Phase 5, Gulshan" onChange={updateProgress} />
              </div>
            </div>
            <div className="field">
              <label>Do you own a vehicle or have reliable transport? <span className="req">*</span></label>
              <select onChange={updateProgress}>
                <option value="">Select</option>
                <option>Yes — own motorcycle</option>
                <option>Yes — own car</option>
                <option>No — use public transport</option>
                <option>No — depend on family/rickshaw</option>
              </select>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <div className="section-num">2</div>
            <div className="section-title">PNC license & professional credentials</div>
          </div>
          <div className="section-body">
            <div className="field-row">
              <div className="field">
                <label>PNC license number <span className="req">*</span></label>
                <input type="text" placeholder="e.g. PNC-XXXXX" defaultValue={extractedData.extractedPncNumber || extractedData.extractedLicense || ''} onChange={updateProgress} />
                <div className="hint">Pakistan Nursing Council registration number</div>
              </div>
              <div className="field">
                <label>PNC license expiry date <span className="req">*</span></label>
                <input type="date" onChange={updateProgress} />
              </div>
            </div>
            <div className="field">
              <label>Professional qualification <span className="req">*</span></label>
              <select onChange={updateProgress}>
                <option value="">Select highest qualification</option>
                <option>Diploma in General Nursing (DGN)</option>
                <option>Bachelor of Science in Nursing (BSN)</option>
                <option>Post-RN BSN</option>
                <option>Master of Science in Nursing (MSN)</option>
                <option>Lady Health Visitor (LHV)</option>
                <option>Nurse Aide / Auxiliary Nurse</option>
                <option>Other</option>
              </select>
            </div>
            <div className="field">
              <label>Specialisation / clinical area</label>
              <div className="tag-select" id="specTags">
                <button type="button" className="tag-btn" onClick={toggleTag}>General nursing</button>
                <button type="button" className="tag-btn" onClick={toggleTag}>ICU / CCU</button>
                <button type="button" className="tag-btn" onClick={toggleTag}>Paediatrics</button>
                <button type="button" className="tag-btn" onClick={toggleTag}>Oncology</button>
                <button type="button" className="tag-btn" onClick={toggleTag}>Orthopaedics</button>
                <button type="button" className="tag-btn" onClick={toggleTag}>Cardiac care</button>
                <button type="button" className="tag-btn" onClick={toggleTag}>Post-surgical</button>
                <button type="button" className="tag-btn" onClick={toggleTag}>Geriatric care</button>
                <button type="button" className="tag-btn" onClick={toggleTag}>Wound care</button>
                <button type="button" className="tag-btn" onClick={toggleTag}>Maternity / midwifery</button>
                <button type="button" className="tag-btn" onClick={toggleTag}>Physiotherapy assist</button>
                <button type="button" className="tag-btn" onClick={toggleTag}>Dialysis</button>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Total years of experience <span className="req">*</span></label>
                <select onChange={updateProgress}>
                  <option value="">Select</option>
                  <option>Less than 1 year</option>
                  <option>1 – 2 years</option>
                  <option>3 – 5 years</option>
                  <option>6 – 10 years</option>
                  <option>More than 10 years</option>
                </select>
              </div>
              <div className="field">
                <label>Experience in home nursing <span className="req">*</span></label>
                <select onChange={updateProgress}>
                  <option value="">Select</option>
                  <option>None — no prior home nursing</option>
                  <option>Less than 1 year</option>
                  <option>1 – 3 years</option>
                  <option>More than 3 years</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Name of institution(s) where currently or previously employed</label>
              <input type="text" placeholder="e.g. Aga Khan Hospital, Liaquat National..." onChange={updateProgress} />
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <div className="section-num">3</div>
            <div className="section-title">Current employment & income</div>
          </div>
          <div className="section-body">
            <div className="field">
              <label>Current employment status <span className="req">*</span></label>
              <div className="radio-group">
                <label className="radio-item"><input type="radio" name="emp" value="full" /> <span className="radio-label">Full-time employed at hospital / clinic</span></label>
                <label className="radio-item"><input type="radio" name="emp" value="part" /> <span className="radio-label">Part-time employed</span></label>
                <label className="radio-item"><input type="radio" name="emp" value="home" /> <span className="radio-label">Currently doing home nursing only</span></label>
                <label className="radio-item"><input type="radio" name="emp" value="unemployed" /> <span className="radio-label">Currently unemployed / seeking work</span></label>
                <label className="radio-item"><input type="radio" name="emp" value="freelance" /> <span className="radio-label">Freelance / self-employed</span></label>
              </div>
            </div>
            <div className="field">
              <label>Average monthly income from primary employment (PKR) <span className="req">*</span></label>
              <select onChange={updateProgress}>
                <option value="">Select range</option>
                <option>Below Rs. 20,000</option>
                <option>Rs. 20,000 – 35,000</option>
                <option>Rs. 35,001 – 50,000</option>
                <option>Rs. 50,001 – 75,000</option>
                <option>Rs. 75,001 – 1,00,000</option>
                <option>Above Rs. 1,00,000</option>
                <option>Not currently employed</option>
                <option>Prefer not to say</option>
              </select>
            </div>
            <div className="field">
              <label>Do you currently earn any supplemental income from home nursing or private patients?</label>
              <div className="radio-group" onChange={(e: any) => {
                const el = document.getElementById('suppIncome');
                if (el) el.style.display = e.target.value === 'yes' ? 'block' : 'none';
              }}>
                <label className="radio-item"><input type="radio" name="supp" value="yes" /> <span className="radio-label">Yes</span></label>
                <label className="radio-item"><input type="radio" name="supp" value="no" /> <span className="radio-label">No</span></label>
              </div>
            </div>
            <div className="field" id="suppIncome" style={{ display: 'none' }}>
              <label>If yes — average monthly supplemental income (PKR)</label>
              <select>
                <option value="">Select range</option>
                <option>Below Rs. 10,000</option>
                <option>Rs. 10,000 – 25,000</option>
                <option>Rs. 25,001 – 50,000</option>
                <option>Above Rs. 50,000</option>
              </select>
            </div>
            <div className="field">
              <label>If offered fair pay, how much would you expect per shift for home nursing? <span className="req">*</span></label>
              <select onChange={updateProgress}>
                <option value="">Select</option>
                <option>Rs. 800 – 1,200 per 8-hour shift</option>
                <option>Rs. 1,200 – 1,800 per 8-hour shift</option>
                <option>Rs. 1,800 – 2,500 per 8-hour shift</option>
                <option>Rs. 2,500 – 3,500 per 8-hour shift</option>
                <option>Above Rs. 3,500 per shift</option>
                <option>I prefer a monthly retainer model</option>
              </select>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <div className="section-num">4</div>
            <div className="section-title">Availability & work preferences</div>
          </div>
          <div className="section-body">
            <div className="field">
              <label>How many hours per week are you available for home nursing work? <span className="req">*</span></label>
              <select onChange={updateProgress}>
                <option value="">Select</option>
                <option>Less than 10 hours/week</option>
                <option>10 – 20 hours/week (1–2 shifts)</option>
                <option>20 – 40 hours/week (3–5 shifts)</option>
                <option>Full time (40+ hours)</option>
                <option>Flexible — depends on the case</option>
              </select>
            </div>
            <div className="field">
              <label>Which shifts are you available for? (Select all that apply)</label>
              <div className="check-group">
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Morning (7 AM – 3 PM)</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Evening (3 PM – 11 PM)</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Night (11 PM – 7 AM)</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">12-hour shifts</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">24-hour live-in shifts</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Hourly / on-call only</span></label>
              </div>
            </div>
            <div className="field">
              <label>Are you willing to travel to patient homes outside your immediate area?</label>
              <select onChange={updateProgress}>
                <option value="">Select</option>
                <option>Yes — within 5 km radius</option>
                <option>Yes — within 10 km radius</option>
                <option>Yes — anywhere in the city</option>
                <option>No — only patients near my home</option>
              </select>
            </div>
            <div className="field">
              <label>Would you consider transitioning to home nursing as your primary employment? <span className="req">*</span></label>
              <div className="radio-group">
                <label className="radio-item"><input type="radio" name="transition" /> <span className="radio-label">Yes — I am actively looking to switch</span></label>
                <label className="radio-item"><input type="radio" name="transition" /> <span className="radio-label">Yes — if income is equal to or better than hospital pay</span></label>
                <label className="radio-item"><input type="radio" name="transition" /> <span className="radio-label">No — I prefer to keep it as supplemental work</span></label>
                <label className="radio-item"><input type="radio" name="transition" /> <span className="radio-label">Unsure — would need more information</span></label>
              </div>
            </div>
            <div className="field">
              <label>What type of patients would you prefer to work with? (Select all that apply)</label>
              <div className="two-col">
                <div className="check-group">
                  <label className="check-item"><input type="checkbox" /> <span className="check-label">Post-surgical recovery</span></label>
                  <label className="check-item"><input type="checkbox" /> <span className="check-label">Elderly / geriatric care</span></label>
                  <label className="check-item"><input type="checkbox" /> <span className="check-label">Critical / ICU-level care</span></label>
                  <label className="check-item"><input type="checkbox" /> <span className="check-label">Stroke / paralysis patients</span></label>
                </div>
                <div className="check-group">
                  <label className="check-item"><input type="checkbox" /> <span className="check-label">Paediatric / newborn care</span></label>
                  <label className="check-item"><input type="checkbox" /> <span className="check-label">Cancer / palliative care</span></label>
                  <label className="check-item"><input type="checkbox" /> <span className="check-label">Mother & baby care</span></label>
                  <label className="check-item"><input type="checkbox" /> <span className="check-label">General assistance / ADLs</span></label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <div className="section-num">5</div>
            <div className="section-title">Direct patient interaction & personal safety</div>
          </div>
          <div className="section-body">
            <div className="field">
              <label>How comfortable are you working alone with patients at their home? <span className="req">*</span></label>
              <div className="scale-row" id="scale1">
                <button type="button" className="scale-btn" onClick={setScale}>1</button>
                <button type="button" className="scale-btn" onClick={setScale}>2</button>
                <button type="button" className="scale-btn" onClick={setScale}>3</button>
                <button type="button" className="scale-btn" onClick={setScale}>4</button>
                <button type="button" className="scale-btn" onClick={setScale}>5</button>
              </div>
              <div className="scale-labels"><span>Not comfortable at all</span><span>Completely comfortable</span></div>
            </div>
            <div className="divider"></div>
            <div className="field">
              <label>Have you experienced any of the following challenges in home nursing? (Select all that apply)</label>
              <div className="check-group">
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Patients or family members behaving disrespectfully or making unreasonable demands</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Feeling unsafe in an unfamiliar neighbourhood or household</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Delayed or non-payment by patients / agencies</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Lack of proper equipment or supplies at the patient's home</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">No support channel if an emergency arose during the shift</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Being asked to perform tasks beyond the agreed scope of care</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Harassment or inappropriate behaviour</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Isolation — no colleague to consult during the shift</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">I have not done home nursing — no prior experience</span></label>
              </div>
            </div>
            <div className="field">
              <label>What are your biggest fears or concerns about home nursing? (Select all that apply)</label>
              <div className="check-group">
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Personal safety, especially as a female nurse</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Being blamed if a patient's condition worsens at home</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">No legal protection or formal employment contract</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Families not following care instructions, creating risk</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Irregular or unpredictable income</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Lack of emergency backup if patient deteriorates</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Social stigma around nurses doing private home work</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">No career growth compared to hospital employment</span></label>
              </div>
            </div>
            <div className="field">
              <label>Would you feel safer working through a registered platform that verifies patient households, provides contracts, and offers emergency support?</label>
              <div className="radio-group">
                <label className="radio-item"><input type="radio" name="safer" /> <span className="radio-label">Yes — it would significantly increase my confidence</span></label>
                <label className="radio-item"><input type="radio" name="safer" /> <span className="radio-label">Somewhat — but I would still have concerns</span></label>
                <label className="radio-item"><input type="radio" name="safer" /> <span className="radio-label">No — I don't feel unsafe working privately</span></label>
              </div>
            </div>
            <div className="field">
              <label>Please describe any specific incident or concern in your own words (optional)</label>
              <textarea placeholder="Share your experience or concern. Your response is completely confidential."></textarea>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <div className="section-num">6</div>
            <div className="section-title">App & platform viability</div>
          </div>
          <div className="section-body">
            <div className="field">
              <label>Are you aware of any app or digital platform for home nursing in Pakistan? <span className="req">*</span></label>
              <div className="radio-group">
                <label className="radio-item"><input type="radio" name="aware" /> <span className="radio-label">Yes — I have used one</span></label>
                <label className="radio-item"><input type="radio" name="aware" /> <span className="radio-label">Yes — I know of one but haven't used it</span></label>
                <label className="radio-item"><input type="radio" name="aware" /> <span className="radio-label">No — I am not aware of any such platform</span></label>
              </div>
            </div>
            <div className="field">
              <label>How do you currently find home nursing work? (Select all that apply)</label>
              <div className="check-group">
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Through a nursing agency</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Word of mouth / personal referrals</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">WhatsApp groups</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Facebook / social media</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Hospital referral</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">I don't currently do home nursing</span></label>
              </div>
            </div>
            <div className="field">
              <label>How viable do you think a home nursing app is in Pakistan's current market? <span className="req">*</span></label>
              <div className="scale-row" id="scale2">
                <button type="button" className="scale-btn" onClick={setScale}>1</button>
                <button type="button" className="scale-btn" onClick={setScale}>2</button>
                <button type="button" className="scale-btn" onClick={setScale}>3</button>
                <button type="button" className="scale-btn" onClick={setScale}>4</button>
                <button type="button" className="scale-btn" onClick={setScale}>5</button>
              </div>
              <div className="scale-labels"><span>Not viable at all</span><span>Extremely viable</span></div>
            </div>
            <div className="divider"></div>
            <div className="field">
              <label>Which features would be most important to you as a nurse on such a platform? Rank your top 3 priorities.</label>
              <div className="check-group">
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Verified patient profiles and background-checked households</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Guaranteed and on-time payment after each shift</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Advance salary / emergency loan facility</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Shift management and scheduling via WhatsApp</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">24/7 emergency support line during shifts</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Digital attendance and payslip record</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Ability to rate and review patients / families</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Legal contract for every assignment</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Training and CPD (Continuing Professional Development) resources</span></label>
                <label className="check-item"><input type="checkbox" /> <span className="check-label">Option to set availability and decline unsuitable cases</span></label>
              </div>
            </div>
            <div className="field">
              <label>Would you recommend such a platform to other nurses you know?</label>
              <div className="scale-row" id="scale3">
                <button type="button" className="scale-btn" onClick={setScale}>1</button>
                <button type="button" className="scale-btn" onClick={setScale}>2</button>
                <button type="button" className="scale-btn" onClick={setScale}>3</button>
                <button type="button" className="scale-btn" onClick={setScale}>4</button>
                <button type="button" className="scale-btn" onClick={setScale}>5</button>
              </div>
              <div className="scale-labels"><span>Definitely not</span><span>Definitely yes</span></div>
            </div>
            <div className="field">
              <label>What is the single biggest barrier to nurses adopting such a platform in Pakistan?</label>
              <textarea placeholder="e.g. trust, internet access, training, agency monopoly, payment reliability..."></textarea>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <div className="section-num">7</div>
            <div className="section-title">Final remarks</div>
          </div>
          <div className="section-body">
            <div className="field">
              <label>Is there anything else you would like us to know — about your experience, expectations, or what would make this platform work for nurses like you?</label>
              <textarea style={{ minHeight: '100px' }} placeholder="Your honest input shapes the product. No response is too long or too short."></textarea>
            </div>
            <div className="field">
              <label>May we contact you for a follow-up interview? (Compensated 30-minute call)</label>
              <div className="radio-group">
                <label className="radio-item"><input type="radio" name="followup" /> <span className="radio-label">Yes — happy to participate</span></label>
                <label className="radio-item"><input type="radio" name="followup" /> <span className="radio-label">No — survey only</span></label>
              </div>
            </div>
          </div>
        </div>

        <div className="consent-box">
          <strong style={{ color: 'var(--color-text-primary)' }}>Data privacy & consent</strong><br />
          By submitting this form you consent to H.M.S.P storing your responses for product research purposes. Your PNC license and CNIC numbers are collected solely for professional verification. No data will be shared with third parties or your employer. You may request deletion of your data at any time by contacting <span style={{ color: '#1D9E75' }}>research@hmsp.pk</span>
        </div>

        <div className="field" style={{ paddingBottom: '1rem' }}>
          <label className="check-item" style={{ cursor: 'pointer' }}>
            <input type="checkbox" id="consentCheck" onChange={updateProgress} />
            <span className="check-label">I have read and agree to the data privacy statement above <span className="req">*</span></span>
          </label>
        </div>

        <div className="submit-area pb-10">
          <button type="button" className="submit-btn" onClick={handleSubmit}>Submit survey</button>
        </div>

      </div>
    </div>
  );
}
