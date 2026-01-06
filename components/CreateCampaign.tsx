
import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  Download, 
  Upload as UploadIcon, 
  Sparkles,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  Eye,
  MessageSquare,
  Edit2,
  Brain,
  Activity,
  CheckCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { GoogleGenAI, Type } from "@google/genai";
import { DemoStep } from './DemoTour';

interface CreateCampaignProps {
  onBack: () => void;
  isDemoMode?: boolean;
  demoStep?: DemoStep;
  setDemoStep?: (step: DemoStep) => void;
}

interface CustomerData {
  [key: string]: any;
}

interface GeneratedMessage {
  customerId: string;
  customerName: string;
  rowNumber: number;
  content: string;
  complianceScore: number;
  status: 'Passed' | 'Failed';
  aiConfidence: number;
  reasoning: string;
}

const CreateCampaign: React.FC<CreateCampaignProps> = ({ onBack, isDemoMode = false, demoStep, setDemoStep }) => {
  const [tone, setTone] = useState('Professional');
  const [prompt, setPrompt] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; rowCount: number; data: CustomerData[] } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResults, setGenerationResults] = useState<GeneratedMessage[]>([]);
  const [currentStep, setCurrentStep] = useState<'config' | 'results'>('config');
  const [selectedMessage, setSelectedMessage] = useState<GeneratedMessage | null>(null);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'content' | 'compliance'>('content');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Demo Automation Logic
  useEffect(() => {
    if (!isDemoMode) return;

    if (demoStep === DemoStep.AUTO_UPLOAD) {
      const sampleData = [
        { customerId: 'CUST001', name: 'Rajesh Kumar', phone: '+919876543210', email: 'rajesh.kumar@example.com', age: 35, city: 'Mumbai', country: 'India', occupation: 'Software Engineer', income: 75000, creditScore: 720 },
        { customerId: 'CUST002', name: 'Priya Sharma', phone: '+919876543211', email: 'priya.sharma@example.com', age: 28, city: 'Delhi', country: 'India', occupation: 'Marketing Manager', income: 90000, creditScore: 780 },
        { customerId: 'CUST003', name: 'Amit Patel', phone: '+919876543212', email: 'amit.patel@example.com', age: 42, city: 'Bangalore', country: 'India', occupation: 'Business Owner', income: 120000, creditScore: 650 }
      ];
      setUploadedFile({ name: 'sample-customers.csv', rowCount: 3, data: sampleData });
    }

    if (demoStep === DemoStep.AUTO_PROMPT) {
      setPrompt('generate a personalized credit card offer for each customer');
    }

    if (demoStep === DemoStep.START_GEN) {
      startGeneration();
    }

    if (demoStep === DemoStep.MODAL_EXPLAIN && generationResults.length > 0) {
      setSelectedMessage(generationResults[0]);
      setEditedContent(generationResults[0].content);
    }
  }, [demoStep, isDemoMode]);

  const startGeneration = async () => {
    const dataToProcess = uploadedFile?.data || [];
    if (dataToProcess.length === 0 || !prompt) return;
    
    setError(null);
    setIsGenerating(true);
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-pro-preview';

    try {
      const results: GeneratedMessage[] = [];
      
      for (let i = 0; i < dataToProcess.length; i++) {
        const customer = dataToProcess[i];
        
        const response = await ai.models.generateContent({
          model,
          contents: `
            Generate a personalized marketing message for the following customer:
            CUSTOMER DATA: ${JSON.stringify(customer)}
            
            CAMPAIGN GOAL: ${prompt}
            DESIRED TONE: ${tone}
            
            Strictly adhere to BFSI compliance standards. 
          `,
          config: {
            systemInstruction: "You are an expert BFSI Marketing Specialist. Ensure compliance and personalization.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                content: { type: Type.STRING },
                complianceScore: { type: Type.INTEGER },
                aiConfidence: { type: Type.INTEGER },
                reasoning: { type: Type.STRING }
              },
              required: ["content", "complianceScore", "aiConfidence", "reasoning"]
            }
          }
        });

        const data = JSON.parse(response.text || '{}');
        
        results.push({
          customerId: customer.customer_id || customer.customerId || `CUST${i+1}`,
          customerName: customer.name || customer.fullName || `Customer ${i+1}`,
          rowNumber: i + 1,
          content: data.content,
          complianceScore: data.complianceScore,
          aiConfidence: data.aiConfidence,
          status: data.complianceScore >= 80 ? 'Passed' : 'Failed',
          reasoning: data.reasoning
        });

        setGenerationResults([...results]);
      }
      
      setCurrentStep('results');
    } catch (err) {
      console.error("Generation error:", err);
      setError("Failed to generate campaign. Please check your prompt.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadSample = () => {
    const csvContent = "customerId,name,phone,email,age,city,country,occupation,income,creditScore\n" +
      "CUST001,Rajesh Kumar,+919876543210,rajesh.kumar@example.com,35,Mumbai,India,Software Engineer,75000,720\n" +
      "CUST002,Priya Sharma,+919876543211,priya.sharma@example.com,28,Delhi,India,Marketing Manager,90000,780\n" +
      "CUST003,Amit Patel,+919876543212,amit.patel@example.com,42,Bangalore,India,Business Owner,120000,650";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "sample-customers.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as CustomerData[];
        setUploadedFile({ name: file.name, rowCount: jsonData.length, data: jsonData });
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleSaveEdit = () => {
    if (selectedMessage) {
      const updatedResults = generationResults.map(msg => 
        msg.rowNumber === selectedMessage.rowNumber ? { ...msg, content: editedContent } : msg
      );
      setGenerationResults(updatedResults);
      setSelectedMessage({ ...selectedMessage, content: editedContent });
      setIsEditing(false);
    }
  };

  if (currentStep === 'results') {
    return (
      <div className="max-w-[1440px] mx-auto px-10 py-12 animate-in fade-in duration-500">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-[40px] font-extrabold text-[#0F172A] mb-2 tracking-tight">Review Generated Campaign</h1>
            <p className="text-[18px] text-[#64748B] font-medium">{generationResults.length} messages generated successfully</p>
          </div>
          <button onClick={() => setCurrentStep('config')} className="text-[#F97316] font-bold flex items-center gap-2">
            <ArrowLeft size={16} /> Back to Editor
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Total Messages', value: generationResults.length.toString(), color: 'text-[#0F172A]' },
            { label: 'Passed', value: generationResults.filter(r => r.status === 'Passed').length.toString(), color: 'text-[#22C55E]' },
            { label: 'Failed', value: generationResults.filter(r => r.status === 'Failed').length.toString(), color: 'text-[#EF4444]' },
            { label: 'Avg Score', value: `${generationResults.length > 0 ? Math.round(generationResults.reduce((acc, curr) => acc + curr.complianceScore, 0) / generationResults.length) : 0}%`, color: 'text-[#0F172A]' }
          ].map((stat, i) => (
            <div key={i} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-widest">{stat.label}</p>
              <p className={`text-4xl font-extrabold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-[1.5rem] border border-gray-100 overflow-hidden shadow-sm">
          <div className="p-8 border-b border-gray-100">
             <h3 className="text-2xl font-bold text-[#0F172A]">Generated Messages</h3>
             <p className="text-gray-500 font-medium">Review and edit AI-generated messages with compliance scores</p>
          </div>
          <table className="w-full text-left">
            <thead className="bg-[#F8FAFC]">
              <tr>
                <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Customer</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Message Preview</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Compliance</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {generationResults.map((res, i) => (
                <tr key={i} className={`hover:bg-gray-50 transition-colors ${i === 0 ? 'bg-[#FFF7ED]/30' : ''}`}>
                  <td className="px-8 py-6">
                    <p className="font-bold text-gray-900">{res.customerName}</p>
                    <p className="text-xs text-gray-400 font-medium mt-0.5 uppercase">Row {res.rowNumber}</p>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed max-w-md">{res.content}</p>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold border ${res.status === 'Passed' ? 'bg-[#F0FDF4] text-[#16A34A] border-[#DCFCE7]' : 'bg-[#FEF2F2] text-[#DC2626] border-[#FEE2E2]'}`}>
                      {res.status === 'Passed' ? <CheckCircle2 size={12} /> : <X size={12} />} {res.complianceScore}% Compliant
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => {
                        setSelectedMessage(res);
                        setEditedContent(res.content);
                        setIsEditing(false);
                      }} 
                      className="inline-flex items-center gap-2 text-[#0F172A] font-bold text-sm hover:underline"
                    >
                      <Eye size={16} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedMessage && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white w-full max-w-4xl rounded-[1.5rem] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                {/* Modal Header */}
                <div className="px-10 py-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                   <div>
                     <h2 className="text-2xl font-bold text-[#0F172A]">Message Details</h2>
                     <p className="text-sm text-gray-500 font-medium">{selectedMessage.customerName} - Row {selectedMessage.rowNumber}</p>
                   </div>
                   <button onClick={() => setSelectedMessage(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={24} /></button>
                </div>

                <div className="p-10 max-h-[75vh] overflow-y-auto space-y-8">
                  {/* Message Content Section */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-base font-bold text-[#0F172A]">Message Content</label>
                      {!isEditing ? (
                        <button 
                          onClick={() => setIsEditing(true)}
                          className={`flex items-center gap-2 px-4 py-1.5 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors ${isDemoMode && demoStep === DemoStep.MODAL_EXPLAIN ? 'ring-4 ring-orange-500 ring-offset-2 scale-110' : ''}`}
                        >
                          <Edit2 size={14} /> Edit
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setIsEditing(false)}
                            className="px-4 py-1.5 border border-gray-200 rounded-lg text-sm font-bold text-gray-400 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={handleSaveEdit}
                            className="px-4 py-1.5 bg-[#F97316] text-white rounded-lg text-sm font-bold hover:bg-[#EA580C]"
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <textarea 
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="w-full h-48 p-6 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 font-medium leading-relaxed outline-none focus:ring-2 focus:ring-orange-100"
                      />
                    ) : (
                      <div className="bg-white border border-gray-100 p-8 rounded-xl min-h-[120px] text-[#64748B] leading-relaxed text-lg shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] whitespace-pre-wrap font-sans">
                        {selectedMessage.content}
                      </div>
                    )}
                  </div>

                  {/* Compliance Status */}
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-[#0F172A]">Compliance Status:</span>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold border ${selectedMessage.status === 'Passed' ? 'bg-[#F0FDF4] text-[#16A34A] border-[#DCFCE7]' : 'bg-[#FEF2F2] text-[#DC2626] border-[#FEE2E2]'}`}>
                      {selectedMessage.status === 'Passed' ? <CheckCircle2 size={12} /> : <X size={12} />} {selectedMessage.complianceScore}% Compliant
                    </span>
                  </div>

                  {/* Tabs Section */}
                  <div className="bg-[#F8FAFC] rounded-xl p-1.5 flex gap-1.5">
                    <button 
                      onClick={() => setActiveAnalysisTab('content')}
                      className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${activeAnalysisTab === 'content' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Content Analysis
                    </button>
                    <button 
                      onClick={() => setActiveAnalysisTab('compliance')}
                      className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${activeAnalysisTab === 'compliance' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Compliance Check
                    </button>
                  </div>

                  {/* Tab Content: Content Analysis */}
                  {activeAnalysisTab === 'content' && (
                    <div className="bg-white border border-gray-100 rounded-2xl p-8 space-y-8 animate-in fade-in duration-300">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-orange-50 text-orange-500 rounded-lg">
                            <Brain size={24} />
                          </div>
                          <h4 className="text-[28px] font-bold text-[#0F172A]">How was this message generated?</h4>
                        </div>
                        <p className="text-[15px] text-gray-500 font-medium">AI reasoning and decision-making process</p>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2 text-green-600 font-bold text-sm uppercase tracking-wider">
                            <Activity size={16} /> AI Confidence
                          </div>
                          <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-md text-[13px] font-black border border-green-100">
                            {selectedMessage.aiConfidence}%
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full transition-all duration-1000"
                            style={{ width: `${selectedMessage.aiConfidence}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 font-medium">
                          {selectedMessage.aiConfidence > 90 ? 'High Confidence - The AI is very confident about this decision' : 'Moderate Confidence - Review is recommended'}
                        </p>
                      </div>

                      <div className="pt-6 border-t border-gray-50">
                        <p className="text-[#64748B] leading-relaxed font-medium">
                          {selectedMessage.reasoning}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-10 py-6 border-t border-gray-100 bg-gray-50 flex justify-end">
                   <button 
                     onClick={() => setSelectedMessage(null)} 
                     className="px-10 py-3 bg-[#0F172A] text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all shadow-lg shadow-gray-100"
                   >
                     Close Review
                   </button>
                </div>
             </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-10 py-12 animate-in fade-in duration-500">
      <div className="mb-10 flex justify-between items-start">
        <button onClick={onBack} className="text-gray-500 font-bold flex items-center gap-2 hover:text-[#F97316] transition-colors">
          <ArrowLeft size={18} /> Back to Dashboard
        </button>
        <div className="text-right">
          <p className="text-sm font-bold text-[#0F172A]">Divya Sivakumar <span className="text-gray-400 font-medium">• Free</span></p>
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl font-bold text-sm flex items-center gap-2">
           <X size={16} /> {error}
        </div>
      )}

      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full mb-4">
          <Sparkles size={14} className="text-gray-600" />
          <span className="text-[12px] font-bold text-gray-600 uppercase tracking-widest">AI-Powered Campaign</span>
        </div>
        <h1 className="text-[48px] font-extrabold text-[#0F172A] mb-2 tracking-tight">Create New Campaign</h1>
        <p className="text-[20px] text-[#64748B] font-medium leading-relaxed">Upload your customer data and configure your marketing campaign</p>
      </div>

      <div className="space-y-8">
        {/* Step 1: Upload */}
        <div className={`bg-white p-10 rounded-[1.5rem] border border-gray-100 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)] transition-all ${isDemoMode && demoStep === DemoStep.EXPLAIN_UPLOAD ? 'ring-4 ring-orange-400 ring-offset-4' : ''}`}>
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <span className="w-10 h-10 bg-[#FFEDD5] text-[#F97316] rounded-xl flex items-center justify-center text-2xl font-black">1</span>
              <h3 className="text-[28px] font-bold text-[#0F172A]">Upload Customer Data</h3>
            </div>
            <button 
              onClick={handleDownloadSample}
              className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm"
            >
              <Download size={16} /> Download Sample
            </button>
          </div>
          
          <p className="text-gray-500 mb-8 font-medium">Upload a CSV file with your customer data (max 10 rows). Required columns: customer_id, name, phone, email, age, location, occupation</p>

          <div 
            onClick={() => !isDemoMode && fileInputRef.current?.click()}
            className={`border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center transition-all group ${uploadedFile ? 'bg-orange-50/30 border-orange-200' : 'hover:bg-gray-50 hover:border-[#F97316] cursor-pointer'}`}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv,.xlsx,.xls" />
            <div className="w-16 h-16 bg-[#FFF7ED] rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <UploadIcon size={32} className="text-[#F97316]" />
            </div>
            {uploadedFile ? (
              <div>
                <p className="text-2xl font-bold text-[#0F172A] mb-1">{uploadedFile.name}</p>
                <p className="text-gray-500 font-medium">{uploadedFile.rowCount} rows detected</p>
              </div>
            ) : (
              <div>
                <p className="text-2xl font-bold text-[#0F172A] mb-1">Drag & drop your CSV file here</p>
                <p className="text-gray-500 font-medium">or click to browse</p>
                <p className="text-[13px] text-gray-400 mt-6 uppercase tracking-widest font-bold">Supports CSV, XLS, XLSX (max 10 rows)</p>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Configure */}
        <div className={`bg-white p-10 rounded-[1.5rem] border border-gray-100 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)] transition-all ${isDemoMode && demoStep === DemoStep.EXPLAIN_PROMPT ? 'ring-4 ring-orange-400 ring-offset-4' : ''}`}>
          <div className="flex items-center gap-4 mb-4">
            <span className="w-10 h-10 bg-[#FFEDD5] text-[#F97316] rounded-xl flex items-center justify-center text-2xl font-black">2</span>
            <h3 className="text-[28px] font-bold text-[#0F172A]">Configure Campaign</h3>
          </div>
          <p className="text-gray-500 mb-8 font-medium">Set your campaign parameters and messaging preferences</p>

          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={18} className="text-gray-500" />
                <label className="text-base font-bold text-gray-700">Campaign Prompt</label>
              </div>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                readOnly={isDemoMode}
                placeholder="Example: Generate a personalized credit card offer highlighting cashback benefits for each customer in the CSV..."
                className="w-full h-40 p-6 rounded-2xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-orange-100 transition-all text-gray-800 font-medium leading-relaxed text-lg"
              />
              <p className="text-sm text-gray-500 mt-2 font-medium">Describe what you want the AI to generate for each customer. The CSV data will be used to personalize the content.</p>
            </div>

            <div>
              <label className="block text-base font-bold text-gray-700 mb-3">Message Tone</label>
              <div className="grid grid-cols-3 gap-4">
                {['Professional', 'Friendly', 'Urgent'].map(t => (
                  <button 
                    key={t}
                    onClick={() => !isDemoMode && setTone(t)}
                    className={`py-4 rounded-xl font-bold text-lg border transition-all ${tone === t ? 'bg-[#F97316] text-white border-[#F97316] shadow-lg shadow-orange-100' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Ready to Generate Block */}
        <div className={`bg-gradient-to-r from-[#F97316] to-[#FB923C] p-8 rounded-[1.5rem] shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 transition-all ${isDemoMode && demoStep === DemoStep.START_GEN ? 'ring-4 ring-white ring-offset-4 scale-[1.02]' : ''}`}>
          <div className="text-left">
            <h3 className="text-2xl font-black text-white mb-1">Ready to Generate?</h3>
            <p className="text-white/90 font-medium text-lg">Review your settings and start the campaign generation</p>
          </div>
          <button 
            onClick={startGeneration}
            disabled={(!uploadedFile || !prompt || isGenerating) && !isDemoMode}
            className="px-10 py-5 bg-white/20 backdrop-blur-md border-2 border-white/40 text-white rounded-2xl font-black text-xl hover:bg-white/30 transition-all flex items-center gap-3 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Start Campaign
          </button>
        </div>
      </div>

      {isGenerating && (
        <div className="fixed inset-0 z-[200] bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-10 animate-in fade-in duration-500">
           <div className="relative mb-8">
              <Loader2 className="animate-spin text-[#F97316]" size={80} />
              <div className="absolute inset-0 flex items-center justify-center">
                 <Sparkles size={24} className="text-orange-300 animate-pulse" />
              </div>
           </div>
           <h2 className="text-[32px] font-black text-[#0F172A] mb-4">Generating {uploadedFile?.rowCount} Messages</h2>
           <p className="text-xl text-gray-500 font-medium text-center max-w-md">Our AI is analyzing your audience data and applying compliance checks for every row...</p>
           
           <div className="mt-12 w-full max-w-md bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-[#F97316] h-full transition-all duration-500"
                style={{ width: `${(generationResults.length / (uploadedFile?.rowCount || 1)) * 100}%` }}
              />
           </div>
           <p className="mt-4 text-sm font-bold text-gray-400">Step {generationResults.length} of {uploadedFile?.rowCount}</p>
        </div>
      )}
    </div>
  );
};

export default CreateCampaign;
