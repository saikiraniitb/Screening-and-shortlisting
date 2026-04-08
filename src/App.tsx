import { useState, useCallback, useMemo } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Users, 
  ChevronRight, 
  Loader2, 
  AlertCircle,
  FileUp,
  Briefcase,
  GraduationCap,
  Mail,
  ArrowLeft,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDropzone } from 'react-dropzone';
import { cn } from './lib/utils';
import { extractTextFromFile } from './lib/parsers';
import { 
  analyzeJD, 
  scoreResumeAgainstJD, 
  parseResume,
  type JDSkills, 
  type ResumeData, 
  type MatchResult 
} from './services/geminiService';

interface Candidate {
  id: string;
  fileName: string;
  resumeData: ResumeData;
  matchResult: MatchResult;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

export default function App() {
  const [step, setStep] = useState<'jd-upload' | 'jd-review' | 'resume-upload' | 'results'>('jd-upload');
  const [jdText, setJdText] = useState('');
  const [jdSkills, setJdSkills] = useState<JDSkills | null>(null);
  const [isAnalyzingJD, setIsAnalyzingJD] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // JD Dropzone
  const onDropJD = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsAnalyzingJD(true);
    try {
      const text = await extractTextFromFile(file);
      setJdText(text);
      const skills = await analyzeJD(text);
      setJdSkills(skills);
      setStep('jd-review');
    } catch (error) {
      console.error('Error analyzing JD:', error);
      alert('Failed to analyze JD. Please try again.');
    } finally {
      setIsAnalyzingJD(false);
    }
  }, []);

  const { getRootProps: getJDProps, getInputProps: getJDInputProps, isDragActive: isJDDragActive } = useDropzone({
    onDrop: onDropJD,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    multiple: false
  });

  // Resume Dropzone
  const onDropResumes = useCallback(async (acceptedFiles: File[]) => {
    if (!jdSkills) return;

    const newCandidates: Candidate[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      fileName: file.name,
      resumeData: { name: '', email: '', skills: [], experience: '', education: [], summary: '', location: '' },
      matchResult: { score: 0, matchedMustHave: [], matchedGoodToHave: [], missingMustHave: [], analysis: '' },
      status: 'pending'
    }));

    setCandidates(prev => [...prev, ...newCandidates]);
    setStep('results');

    // Process each resume
    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      const candidateId = newCandidates[i].id;

      setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, status: 'processing' } : c));

      try {
        const text = await extractTextFromFile(file);
        const [resumeData, matchResult] = await Promise.all([
          parseResume(text),
          scoreResumeAgainstJD(text, jdSkills)
        ]);

        setCandidates(prev => prev.map(c => c.id === candidateId ? { 
          ...c, 
          resumeData, 
          matchResult, 
          status: 'completed' 
        } : c));
      } catch (error) {
        console.error(`Error processing resume ${file.name}:`, error);
        setCandidates(prev => prev.map(c => c.id === candidateId ? { 
          ...c, 
          status: 'error', 
          error: 'Failed to process resume' 
        } : c));
      }
    }
  }, [jdSkills]);

  const { getRootProps: getResumeProps, getInputProps: getResumeInputProps, isDragActive: isResumeDragActive } = useDropzone({
    onDrop: onDropResumes,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    }
  });

  const filteredCandidates = useMemo(() => {
    return candidates
      .filter(c => 
        c.resumeData.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.resumeData.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => b.matchResult.score - a.matchResult.score);
  }, [candidates, searchQuery]);

  const stats = useMemo(() => {
    const completed = candidates.filter(c => c.status === 'completed');
    const avgScore = completed.length > 0 
      ? Math.round(completed.reduce((acc, c) => acc + c.matchResult.score, 0) / completed.length)
      : 0;
    return { completed: completed.length, total: candidates.length, avgScore };
  }, [candidates]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E5E5] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0052CC] rounded-xl flex items-center justify-center text-white">
              <Users size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">TalentMatch AI</h1>
              <p className="text-xs text-[#6B778C] font-medium uppercase tracking-wider">Resume Screening Intelligence</p>
            </div>
          </div>
          
          {step !== 'jd-upload' && (
            <button 
              onClick={() => {
                if (confirm('Are you sure you want to start over?')) {
                  setStep('jd-upload');
                  setCandidates([]);
                  setJdSkills(null);
                }
              }}
              className="text-sm font-medium text-[#0052CC] hover:underline"
            >
              Start Over
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {/* Step 1: JD Upload */}
          {step === 'jd-upload' && (
            <motion.div 
              key="jd-upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto text-center"
            >
              <h2 className="text-3xl font-bold mb-4">Upload Job Description</h2>
              <p className="text-[#6B778C] mb-8">
                Start by uploading the JD. Our AI will extract key requirements to match candidates.
              </p>

              <div 
                {...getJDProps()} 
                className={cn(
                  "border-2 border-dashed rounded-3xl p-12 transition-all cursor-pointer bg-white",
                  isJDDragActive ? "border-[#0052CC] bg-[#DEEBFF]" : "border-[#DFE1E6] hover:border-[#0052CC]"
                )}
              >
                <input {...getJDInputProps()} />
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-[#F4F5F7] rounded-full flex items-center justify-center mb-4">
                    {isAnalyzingJD ? (
                      <Loader2 className="animate-spin text-[#0052CC]" size={32} />
                    ) : (
                      <FileUp className="text-[#0052CC]" size={32} />
                    )}
                  </div>
                  <p className="text-lg font-semibold mb-1">
                    {isAnalyzingJD ? "Analyzing Requirements..." : "Drop JD here or click to upload"}
                  </p>
                  <p className="text-sm text-[#6B778C]">Supports PDF, DOCX, and TXT</p>
                </div>
              </div>

              <div className="mt-12 grid grid-cols-3 gap-6">
                {[
                  { icon: <Search size={20} />, title: "Semantic Analysis", desc: "Understands context beyond keywords" },
                  { icon: <CheckCircle2 size={20} />, title: "Skill Extraction", desc: "Identifies must-have vs good-to-have" },
                  { icon: <Users size={20} />, title: "Ranked Results", desc: "Instant shortlisting of top talent" }
                ].map((feature, i) => (
                  <div key={i} className="text-left p-4 bg-white rounded-2xl border border-[#E5E5E5]">
                    <div className="text-[#0052CC] mb-2">{feature.icon}</div>
                    <h3 className="font-bold text-sm mb-1">{feature.title}</h3>
                    <p className="text-xs text-[#6B778C]">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: JD Review */}
          {step === 'jd-review' && jdSkills && (
            <motion.div 
              key="jd-review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="max-w-4xl mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setStep('jd-upload')}
                    className="p-2 hover:bg-[#F4F5F7] rounded-xl text-[#6B778C]"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold">{jdSkills.roleTitle}</h2>
                    <p className="text-[#6B778C]">Review the extracted requirements before proceeding.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setStep('resume-upload')}
                  className="bg-[#0052CC] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#0747A6] transition-colors flex items-center gap-2"
                >
                  Confirm & Upload Resumes <ChevronRight size={18} />
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-[#E5E5E5]">
                  <div className="flex items-center gap-2 mb-4 text-[#00875A]">
                    <CheckCircle2 size={20} />
                    <h3 className="font-bold uppercase tracking-wider text-xs">Must-Have Skills</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {jdSkills.mustHave.map((skill, i) => (
                      <span key={i} className="px-3 py-1.5 bg-[#E3FCEF] text-[#006644] rounded-lg text-sm font-medium border border-[#ABF5D1]">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#E5E5E5]">
                  <div className="flex items-center gap-2 mb-4 text-[#0052CC]">
                    <Info size={20} />
                    <h3 className="font-bold uppercase tracking-wider text-xs">Good-to-Have Skills</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {jdSkills.goodToHave.map((skill, i) => (
                      <span key={i} className="px-3 py-1.5 bg-[#DEEBFF] text-[#0052CC] rounded-lg text-sm font-medium border border-[#B3D4FF]">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#E5E5E5]">
                  <div className="flex items-center gap-2 mb-4 text-[#FFAB00]">
                    <Briefcase size={20} />
                    <h3 className="font-bold uppercase tracking-wider text-xs">Experience Required</h3>
                  </div>
                  <p className="text-sm font-medium text-[#172B4D]">{jdSkills.experience}</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#E5E5E5]">
                  <div className="flex items-center gap-2 mb-4 text-[#6554C0]">
                    <Search size={20} />
                    <h3 className="font-bold uppercase tracking-wider text-xs">Location</h3>
                  </div>
                  <p className="text-sm font-medium text-[#172B4D]">{jdSkills.location}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Resume Upload */}
          {step === 'resume-upload' && (
            <motion.div 
              key="resume-upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto text-center"
            >
              <h2 className="text-3xl font-bold mb-4">Upload Resumes</h2>
              <p className="text-[#6B778C] mb-8">
                Upload multiple resumes to screen them against <strong>{jdSkills?.roleTitle}</strong>.
              </p>

              <div 
                {...getResumeProps()} 
                className={cn(
                  "border-2 border-dashed rounded-3xl p-16 transition-all cursor-pointer bg-white",
                  isResumeDragActive ? "border-[#0052CC] bg-[#DEEBFF]" : "border-[#DFE1E6] hover:border-[#0052CC]"
                )}
              >
                <input {...getResumeInputProps()} />
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-[#F4F5F7] rounded-full flex items-center justify-center mb-6">
                    <Upload className="text-[#0052CC]" size={40} />
                  </div>
                  <p className="text-xl font-bold mb-2">Drop resumes here</p>
                  <p className="text-sm text-[#6B778C]">Upload up to 50+ resumes (PDF or DOCX)</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Results Dashboard */}
          {step === 'results' && (
            <motion.div 
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Stats Bar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5] shadow-sm">
                  <p className="text-xs font-bold text-[#6B778C] uppercase tracking-wider mb-1">Total Resumes</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5] shadow-sm">
                  <p className="text-xs font-bold text-[#6B778C] uppercase tracking-wider mb-1">Processed</p>
                  <p className="text-3xl font-bold text-[#00875A]">{stats.completed}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5] shadow-sm">
                  <p className="text-xs font-bold text-[#6B778C] uppercase tracking-wider mb-1">Avg Match Score</p>
                  <p className="text-3xl font-bold text-[#0052CC]">{stats.avgScore}%</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5] shadow-sm flex items-center justify-center">
                  <button 
                    {...getResumeProps()}
                    className="w-full h-full flex items-center justify-center gap-2 text-[#0052CC] font-bold hover:bg-[#F4F5F7] rounded-xl transition-colors"
                  >
                    <input {...getResumeInputProps()} />
                    <Upload size={20} /> Add More
                  </button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-8">
                {/* Candidate List */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-[#E5E5E5]">
                    <div className="pl-3 text-[#6B778C]"><Search size={20} /></div>
                    <input 
                      type="text" 
                      placeholder="Search by name or skill..."
                      className="flex-1 bg-transparent border-none outline-none py-2 text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F4F5F7] border-b border-[#E5E5E5]">
                          <th className="px-6 py-4 text-xs font-bold text-[#6B778C] uppercase tracking-wider">Candidate</th>
                          <th className="px-6 py-4 text-xs font-bold text-[#6B778C] uppercase tracking-wider">Match Score</th>
                          <th className="px-6 py-4 text-xs font-bold text-[#6B778C] uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-xs font-bold text-[#6B778C] uppercase tracking-wider text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E5E5]">
                        {filteredCandidates.map((candidate) => (
                          <tr 
                            key={candidate.id}
                            className={cn(
                              "hover:bg-[#F4F5F7] transition-colors cursor-pointer",
                              selectedCandidate?.id === candidate.id && "bg-[#DEEBFF]"
                            )}
                            onClick={() => candidate.status === 'completed' && setSelectedCandidate(candidate)}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#F4F5F7] rounded-full flex items-center justify-center font-bold text-[#0052CC]">
                                  {candidate.resumeData.name ? candidate.resumeData.name[0] : <FileText size={20} />}
                                </div>
                                <div>
                                  <p className="font-bold text-sm">{candidate.resumeData.name || candidate.fileName}</p>
                                  <p className="text-xs text-[#6B778C]">{candidate.resumeData.email || 'Processing...'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {candidate.status === 'completed' ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-[#EBECF0] rounded-full overflow-hidden">
                                    <div 
                                      className={cn(
                                        "h-full transition-all duration-1000",
                                        candidate.matchResult.score > 80 ? "bg-[#00875A]" : 
                                        candidate.matchResult.score > 50 ? "bg-[#FFAB00]" : "bg-[#DE350B]"
                                      )}
                                      style={{ width: `${candidate.matchResult.score}%` }}
                                    />
                                  </div>
                                  <span className="font-bold text-sm">{candidate.matchResult.score}%</span>
                                </div>
                              ) : (
                                <span className="text-xs text-[#6B778C]">--</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {candidate.status === 'processing' ? (
                                <div className="flex items-center gap-2 text-[#0052CC] text-xs font-bold">
                                  <Loader2 size={14} className="animate-spin" /> Processing
                                </div>
                              ) : candidate.status === 'completed' ? (
                                <div className="flex items-center gap-2 text-[#00875A] text-xs font-bold">
                                  <CheckCircle2 size={14} /> Completed
                                </div>
                              ) : candidate.status === 'error' ? (
                                <div className="flex items-center gap-2 text-[#DE350B] text-xs font-bold">
                                  <AlertCircle size={14} /> Error
                                </div>
                              ) : (
                                <span className="text-xs text-[#6B778C]">Pending</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <ChevronRight size={20} className="inline text-[#6B778C]" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredCandidates.length === 0 && (
                      <div className="p-12 text-center">
                        <p className="text-[#6B778C]">No candidates found matching your search.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Detailed Report Panel */}
                <div className="w-full md:w-[450px]">
                  <AnimatePresence mode="wait">
                    {selectedCandidate ? (
                      <motion.div 
                        key={selectedCandidate.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="bg-white rounded-3xl border border-[#E5E5E5] shadow-xl overflow-hidden sticky top-24"
                      >
                        <div className="p-6 bg-[#0052CC] text-white">
                          <div className="flex justify-between items-start mb-4">
                            <button onClick={() => setSelectedCandidate(null)} className="p-1 hover:bg-white/10 rounded-lg">
                              <ArrowLeft size={20} />
                            </button>
                            <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">
                              Match Score: {selectedCandidate.matchResult.score}%
                            </div>
                          </div>
                          <h3 className="text-2xl font-bold mb-1">{selectedCandidate.resumeData.name}</h3>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-white/80 text-sm">
                            <p className="flex items-center gap-2">
                              <Mail size={14} /> {selectedCandidate.resumeData.email}
                            </p>
                            <p className="flex items-center gap-2">
                              <Search size={14} /> {selectedCandidate.resumeData.location}
                            </p>
                          </div>
                        </div>

                        <div className="p-6 space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto">
                          <div>
                            <h4 className="text-xs font-bold text-[#6B778C] uppercase tracking-wider mb-2">Summary</h4>
                            <p className="text-sm leading-relaxed">{selectedCandidate.resumeData.summary}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#F4F5F7] p-3 rounded-xl">
                              <div className="flex items-center gap-2 text-[#0052CC] mb-1">
                                <Briefcase size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Experience</span>
                              </div>
                              <p className="text-xs font-medium line-clamp-2">{selectedCandidate.resumeData.experience}</p>
                            </div>
                            <div className="bg-[#F4F5F7] p-3 rounded-xl">
                              <div className="flex items-center gap-2 text-[#0052CC] mb-1">
                                <GraduationCap size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Education</span>
                              </div>
                              <p className="text-xs font-medium line-clamp-2">{selectedCandidate.resumeData.education[0] || 'N/A'}</p>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold text-[#6B778C] uppercase tracking-wider mb-3">Skill Matching</h4>
                            <div className="space-y-4">
                              <div>
                                <p className="text-[10px] font-bold text-[#00875A] uppercase mb-2">Matched Must-Have</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {selectedCandidate.matchResult.matchedMustHave.map((s, i) => (
                                    <span key={i} className="px-2 py-1 bg-[#E3FCEF] text-[#006644] rounded text-[10px] font-bold border border-[#ABF5D1]">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              {selectedCandidate.matchResult.missingMustHave.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold text-[#DE350B] uppercase mb-2">Missing Must-Have</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {selectedCandidate.matchResult.missingMustHave.map((s, i) => (
                                      <span key={i} className="px-2 py-1 bg-[#FFEBE6] text-[#BF2600] rounded text-[10px] font-bold border border-[#FFBDAD]">
                                        {s}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold text-[#6B778C] uppercase tracking-wider mb-2">AI Analysis</h4>
                            <div className="bg-[#DEEBFF] p-4 rounded-2xl text-sm text-[#0747A6] leading-relaxed italic border border-[#B3D4FF]">
                              "{selectedCandidate.matchResult.analysis}"
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="h-[600px] bg-white rounded-3xl border border-[#E5E5E5] border-dashed flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-16 h-16 bg-[#F4F5F7] rounded-full flex items-center justify-center mb-4 text-[#6B778C]">
                          <Users size={32} />
                        </div>
                        <h3 className="font-bold mb-2">Select a Candidate</h3>
                        <p className="text-sm text-[#6B778C]">Click on a candidate from the list to view their detailed match report and AI analysis.</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
