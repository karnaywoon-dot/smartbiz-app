import { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default function App() {
  const [input, setInput] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Slip State
  const [image, setImage] = useState<File | null>(null);
  const [expectedAmount, setExpectedAmount] = useState('');
  const [slipResult, setSlipResult] = useState<string>('');

  // 1. Text AI Chat
  const handleSend = async () => {
    if (!input) return;
    setLoading(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `You are a helpful B2B AI Sales Assistant in Myanmar. Answer concisely in Myanmar language: ${input}`;
      const result = await model.generateContent(prompt);
      setReply(result.response.text());
    } catch (error) {
      setReply('API Key သို့မဟုတ် ချိတ်ဆက်မှု စစ်ဆေးပါ။');
    } finally {
      setLoading(false);
    }
  };

  // 2. Vision AI - Slip Check
  const handleSlipVerify = async () => {
    if (!image || !expectedAmount) {
      alert('စလစ်ပုံနှင့် စစ်ဆေးလိုသော ငွေပမာဏကို ထည့်ပေးပါ။');
      return;
    }
    setLoading(true);
    setSlipResult('');

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // Convert File to Base64
      const reader = new FileReader();
      reader.readAsDataURL(image);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        const prompt = `
        Analyze this Myanmar payment slip image (KPay, WavePay, CBPay, AYA, KBZ etc.).
        Extract the total transferred amount and the transaction ID.
        Return strictly in this format:
        Amount: [extracted number]
        TxnID: [extracted string]
        `;

        const result = await model.generateContent([
          prompt,
          { inlineData: { data: base64Data, mimeType: image.type } }
        ]);

        const text = result.response.text();
        setSlipResult(text);
      };
    } catch (error) {
      setSlipResult('စလစ်အား စစ်ဆေး၍ မရပါ၊ ပုံစံ မှန်မမှန် ပြန်စစ်ပါ။');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '30px', maxWidth: '550px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center' }}>SmartBiz AI B2B Suite</h2>

      {/* Feature 1: AI Chat */}
      <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>၁။ AI Sales Assistant Chat</h3>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="မေးခွန်း ရိုက်ထည့်ပါ..."
          style={{ width: '95%', padding: '10px', marginBottom: '10px' }}
        />
        <button
          onClick={handleSend}
          style={{ width: '100%', padding: '10px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {loading ? 'မေးမြန်းနေသည်...' : 'မေးမည်'}
        </button>
        {reply && (
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f4f8', borderRadius: '4px' }}>
            <strong>AI အကြောင်းပြန်ချက်:</strong>
            <p>{reply}</p>
          </div>
        )}
      </div>

      {/* Feature 2: Slip OCR Verification */}
      <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px' }}>
        <h3>၂။ KPay / Bank Slip OCR Checker</h3>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImage(e.target.files?.[0] || null)}
          style={{ marginBottom: '10px', display: 'block' }}
        />
        <input
          type="number"
          value={expectedAmount}
          onChange={(e) => setExpectedAmount(e.target.value)}
          placeholder="ကျသင့်ငွေ (ဥပမာ - 50000)"
          style={{ width: '95%', padding: '10px', marginBottom: '10px' }}
        />
        <button
          onClick={handleSlipVerify}
          style={{ width: '100%', padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {loading ? 'စလစ်အား စစ်ဆေးနေသည်...' : 'စလစ်စစ်မည်'}
        </button>
        {slipResult && (
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#eef9f1', borderRadius: '4px' }}>
            <strong>စလစ် စစ်ဆေးချက် ရလဒ်:</strong>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{slipResult}</pre>
          </div>
        )}
      </div>
    </div>
  );
}