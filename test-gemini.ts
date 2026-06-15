import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";

// Load environment variables if running locally
dotenv.config();

async function testGeminiConnection() {
  console.log("🔍 Starting Gemini API Connectivity Test...");
  
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY?.trim();
  
  if (!apiKey) {
    console.error("❌ ERROR: GOOGLE_GEMINI_API_KEY is not set in the environment!");
    console.log("   Make sure you have loaded it in your Edge Function environment or local .env file.");
    process.exit(1);
  }

  console.log(`✅ API Key found: ${apiKey.substring(0, 8)}... (truncated)`);
  console.log("📡 Initializing @google/genai SDK...");

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });

    console.log("🤖 Sending ping to gemini-2.5-flash...");
    
    // Send a minimal prompt to minimize token usage
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Respond with exactly one word: 'SUCCESS'."
    });
    
    const text = response.text;

    console.log("==========================================");
    console.log("🎉 SUCCESS! Received response from Gemini:");
    console.log(`💬 "${text.trim()}"`);
    console.log("==========================================");
    console.log("If your app is still failing, the issue is likely in your payload, prompt formatting, or JSON parsing logic, NOT your API key or network.");

  } catch (error: any) {
    console.log("==========================================");
    console.error("❌ API CALL FAILED!");
    console.error("Error Message:", error.message);
    console.error("Status:", error.status);
    console.error("Full Error Object:", JSON.stringify(error, null, 2));
    console.log("==========================================");
    
    if (error.status === 403) {
      console.log("💡 DIAGNOSIS: 403 Forbidden.");
      console.log("   - Check if your API key has the Generative Language API enabled in Google Cloud Console.");
      console.log("   - Check if your key has API restrictions preventing this IP/URL from calling it.");
      console.log("   - Check if you are in a supported region for Gemini API access.");
    } else if (error.status === 400) {
      console.log("💡 DIAGNOSIS: 400 Bad Request.");
      console.log("   - Your request payload might be malformed or using an unsupported model name.");
    }
  }
}

testGeminiConnection();
