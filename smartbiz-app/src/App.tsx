import { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Supabase Client Initializer
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase Environment Variables!");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [input, setInput] = useState('');
  const [reply, setReply] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Slip State
  const [customerName, setCustomerName] = useState('');
  const [image, setImage] = useState<File null |>(null);
  const [expectedAmount, setExpectedAmount] = useState('');
  const [slipResult, setSlipResult] = useState<string>('');
  const [slipLoading, setSlipLoading] = useState(false);

  // Database Orders State
  const [orders, setOrders] = useState<any[]>([]);

  // Supabase မှ Order များ ဆွဲထုတ်သည့် Function
  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('cod_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Fetch Orders Error:", error);
    } else if (data) {
      setOrders(data);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // 1. Text AI Chat
  const handleSend = async () => {
    if (!input) return;
    setChatLoading(true);
    setReply('');
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Missing Gemini API Key");
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `You are a helpful B2B AI Sales Assistant in Myanmar. Answer concisely in Myanmar language: ${input}`;
      const result = await model.generateContent(prompt);
      setReply(result.response.text());
    } catch (error: any) {
      console.error("Chat Error:", error);
      setReply(`အမှားအယွင်းဖြစ်ပေါ်နေပါသည်: ${error.message}`);
    } finally {
      setChatLoading(false);
    }
  };

  // Helper Function: Convert File to Base64
  const fileToGenerativePart = async (file: File) => {
    return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = (reader.result as string).split(',')[1];
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type,
          },
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 2. Vision AI & Supabase Database Insertion
  const handleSlipVerify = async () => {
    if (!image || !expectedAmount) {
      alert('စလစ်ပုံနှင့် စစ်ဆေးလိုသော ငွေပမာဏကို ထည့်ပေးပါ။');
      return;
    }
    setSlipLoading(true);
    setSlipResult('');

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Missing Gemini API Key");

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }); // Changed to stable version

      const imagePart = await fileToGenerativePart(image);

      const prompt = `
      Analyze this Myanmar payment slip image (KPay, WavePay, CBPay, AYA, KBZ etc.).
      Extract the total transferred amount and transaction ID.
      The expected amount to verify is: ${expectedAmount} MMK.

      Respond ONLY with a JSON object. Do not include any extra text or markdown formatting.
      Format exactly like this:
      {
        "amount": 50000,
        "transaction_id": "123456789",
        "status": "MATCHED"
      }
      `;

      const result = await model.generateContent([prompt, imagePart]);
      const rawText = result.response.text();
      
      // Safely extract JSON using Regex to prevent parsing errors
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI did not return a valid JSON format.");
      
      const parsedData = JSON.parse(jsonMatch[0]);

      setSlipResult(
        `ကျသင့်ငွေ: ${expectedAmount} MMK\nစလစ်ပါငွေ: ${parsedData.amount} MMK\nအခြေအနေ: ${parsedData.status}\nTransaction ID: ${parsedData.transaction_id}`
      );

      // Supabase cod_orders Table ထဲသို့ Data ထည့်သွင်းခြင်း
      const { error: dbError } = await supabase.from('cod_orders').insert([
        {
          customer_name: customerName || 'General Customer',
          amount: Number(parsedData.amount) || Number(expectedAmount),
          transaction_id: parsedData.transaction_id || 'UNKNOWN',
          status: parsedData.status || 'PENDING',
        },
      ]);

      if (dbError) {
        console.error('Supabase Save Error:', dbError);
        alert(`Database သို့ မှတ်တမ်းတင်ရာတွင် အမှားဖြစ်နေပါသည်: ${dbError.message}`);
      } else {
        alert('စလစ်မှတ်တမ်းကို Database သို့ အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
        fetchOrders(); // UI ရဲ့ Table ကို အလိုအလျောက် Update လုပ်မည်
      }
    } catch (error: any) {
      console.error("OCR/DB Error Detail:", error);
      setSlipResult(`စလစ်အား စစ်ဆေး၍ မရပါ: ${error?.message || 'Unknown Error'}`);
    } finally {
      setSlipLoading(false);
    }
  };

  return (
    <div style={{ padding: '30px', maxWidth: '650px', margin: '0 auto', fontFamily: 'var(--sans, sans-serif)' }}>
      <h2 style={{ textAlign: 'center' }}>SmartBiz AI B2B Suite</h2>

      {/* Feature 1: AI Chat */}
      <div style={{ border: '1px solid var(--border, #ddd)', padding: '15px', borderRadius: '8px', marginBottom: '20px', backgroundColor: 'var(--bg, #fff)' }}>
        <h3>၁။ AI Sales Assistant Chat</h3>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="မေးခွန်း ရိုက်ထည့်ပါ..."
          style={{ width: '95%', padding: '10px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        <button
          onClick={handleSend}
          disabled={chatLoading}
          style={{ width: '100%', padding: '10px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {chatLoading ? 'မေးမြန်းနေသည်...' : 'မေးမည်'}
        </button>
        {reply && (
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'var(--code-bg, #f0f4f8)', borderRadius: '4px', color: 'var(--text-h, #000)' }}>
            <strong>AI အကြောင်းပြန်ချက်:</strong>
            <p style={{ marginTop: '8px' }}>{reply}</p>
          </div>
        )}
      </div>

      {/* Feature 2: Slip OCR Verification */}
      <div style={{ border: '1px solid var(--border, #ddd)', padding: '15px', borderRadius: '8px', marginBottom: '20px', backgroundColor: 'var(--bg, #fff)' }}>
        <h3>၂။ KPay / Bank Slip OCR Checker</h3>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="ဝယ်ယူသူအမည် (Customer Name)"
          style={{ width: '95%', padding: '10px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
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
          style={{ width: '95%', padding: '10px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        <button
          onClick={handleSlipVerify}
          disabled={slipLoading}
          style={{ width: '100%', padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {slipLoading ? 'စလစ်အား စစ်ဆေးနေသည်...' : 'စလစ်စစ်မည်'}
        </button>
        {slipResult && (
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'rgba(40, 167, 69, 0.1)', borderRadius: '4px', color: 'var(--text-h, #000)' }}>
            <strong>စလစ် စစ်ဆေးချက် ရလဒ်:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', marginTop: '8px', fontFamily: 'var(--mono, monospace)' }}>{slipResult}</pre>
          </div>
        )}
      </div>

      {/* Feature 3: Order History Dashboard */}
      <div style={{ border: '1px solid var(--border, #ddd)', padding: '15px', borderRadius: '8px', backgroundColor: 'var(--bg, #fff)' }}>
        <h3>၃။ စလစ်စစ်ဆေးပြီး နောက်ဆုံး အမှာစာများ (Supabase DB)</h3>
        {orders.length === 0 ? (
          <p style={{ color: '#888' }}>မှတ်တမ်း မရှိသေးပါ။</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'var(--text-h, #000)' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border, #ddd)' }}>
                  <th style={{ padding: '8px' }}>အမည်</th>
                  <th style={{ padding: '8px' }}>ငွေပမာဏ</th>
                  <th style={{ padding: '8px' }}>Txn ID</th>
                  <th style={{ padding: '8px' }}>အခြေအနေ</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--border, #eee)' }}>
                    <td style={{ padding: '8px' }}>{o.customer_name}</td>
                    <td style={{ padding: '8px' }}>{o.amount?.toLocaleString()} MMK</td>
                    <td style={{ padding: '8px' }}>{o.transaction_id}</td>
                    <td style={{ padding: '8px', fontWeight: 'bold', color: o.status === 'MATCHED' ? '#28a745' : '#dc3545' }}>
                      {o.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}