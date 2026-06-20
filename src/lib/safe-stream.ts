export interface Violation {
  id?: string;
  severity: "critical" | "serious" | "moderate" | "minor";
  name: string;
  wcag_criterion: string;
  description: string;
  element_affected?: string;
  legal_impact?: string;
  fix_instructions: string;
  estimated_fix_time?: string;
  code_fix?: string;
  revenue_impact?: string;
  fix_difficulty?: "easy" | "medium" | "hard";
  screenshot_selector?: string;
  // Fallbacks for backward compatibility
  element?: string;
  fix?: string;
  violation?: string;
}

export interface AuditResult {
  overall_score: number;
  compliance_score?: number;
  category_scores?: {
    perceivable: number;
    operable: number;
    understandable: number;
    robust: number;
  };
  violations: Violation[];
  systemic_issues?: Array<{
    pattern: string;
    count: number;
    description: string;
    impact: string;
  }>;
  urgency_score?: number;
  urgency_reason?: string;
  industry_benchmark?: string;
  score_prediction?: any;
  hours_breakdown?: any;
}

export interface StreamHandlers {
  /**
   * Fired immediately upon receiving a raw text chunk from the LLM endpoint.
   * Useful for updating streaming UI directly without waiting for a full JSON parse.
   */
  onChunk?: (chunkText: string) => void;
  
  /**
   * Fired if the stream encounters a network or parsing error.
   */
  onError?: (error: Error) => void;
  
  /**
   * Fired once the stream is complete and safely parsed into an AuditResult.
   */
  onComplete?: (parsedResult: AuditResult | null, rawAccumulated: string) => void;
}

/**
 * Robust stream handler ensuring ZERO-DB dependencies and resilient parsing.
 * Takes a ReadableStream or Fetch Response, immediately processes chunks,
 * and defers JSON parsing until stream completion to avoid fragmentation crashes.
 */
export async function handleAuditStream(
  response: Response | ReadableStream<Uint8Array>,
  handlers: StreamHandlers
): Promise<AuditResult | null> {
  let stream: ReadableStreamDefaultReader<Uint8Array>;

  if (response instanceof Response) {
    if (!response.body) {
      throw new Error("Response body is empty.");
    }
    stream = response.body.getReader();
  } else {
    stream = response.getReader();
  }

  // Use `{ stream: true }` in TextDecoder to safely handle multi-byte characters
  // that may be split across chunk boundaries.
  const decoder = new TextDecoder("utf-8");
  let accumulatedText = "";

  try {
    while (true) {
      const { done, value } = await stream.read();

      if (value) {
        // Decode chunk immediately
        const chunkStr = decoder.decode(value, { stream: true });
        accumulatedText += chunkStr;

        // Immediate callback for zero artificial delay UI streaming
        if (handlers.onChunk) {
          handlers.onChunk(chunkStr);
        }
      }

      if (done) {
        // Flush the decoder
        const finalChunk = decoder.decode();
        accumulatedText += finalChunk;
        
        if (handlers.onChunk && finalChunk) {
          handlers.onChunk(finalChunk);
        }
        break;
      }
    }

    // Attempt to safely parse the accumulated payload ONLY once stream is complete
    let parsedResult: AuditResult | null = null;
    let jsonToParse = accumulatedText.trim();
    
    // Pre-process: Strip common LLM Markdown wrapping
    if (jsonToParse.startsWith("```json")) {
      jsonToParse = jsonToParse.replace(/^```json\n?/, "");
      if (jsonToParse.endsWith("```")) {
        jsonToParse = jsonToParse.replace(/```$/, "");
      }
    } else if (jsonToParse.startsWith("```")) {
      jsonToParse = jsonToParse.replace(/^```\n?/, "");
      if (jsonToParse.endsWith("```")) {
        jsonToParse = jsonToParse.replace(/```$/, "");
      }
    }

    try {
      parsedResult = JSON.parse(jsonToParse);
    } catch (parseError) {
      console.warn("[safe-stream] Strict JSON parse failed. Attempting loose extraction.");
      
      // Fallback extraction for trailing garbage
      const firstBrace = jsonToParse.indexOf("{");
      const lastBrace = jsonToParse.lastIndexOf("}");
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          parsedResult = JSON.parse(jsonToParse.substring(firstBrace, lastBrace + 1));
        } catch (e) {
          throw new Error("Accumulated stream data could not be parsed: " + (parseError as Error).message);
        }
      } else {
        throw new Error("Accumulated stream data does not contain a valid JSON object.");
      }
    }

    if (handlers.onComplete) {
      handlers.onComplete(parsedResult, accumulatedText);
    }
    
    return parsedResult;

  } catch (err: any) {
    if (handlers.onError) {
      handlers.onError(err);
    }
    throw err;
  } finally {
    stream.releaseLock();
  }
}
