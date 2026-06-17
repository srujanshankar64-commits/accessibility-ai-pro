import { useEffect, useRef, useState } from "react";

interface TerminalProps {
  logs: string[];
  isActive?: boolean;
}

export function Terminal({ logs, isActive = false }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (terminalRef.current && autoScroll) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const getLineColor = (line: string): string => {
    if (line.startsWith("[FINDING]")) return "text-red-500 font-bold text-shadow-red";
    if (line.startsWith("[STATUS]")) return "text-yellow-400 font-semibold text-shadow-yellow";
    if (line.startsWith("[LOG]")) return "text-green-500 text-shadow-green";
    if (line.startsWith("[ERROR]")) return "text-red-600 font-bold text-shadow-red";
    return "text-gray-300";
  };

  const handleScroll = () => {
    if (terminalRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 50;
      setAutoScroll(isAtBottom);
    }
  };

  return (
    <div
      className="relative w-full h-96 bg-black rounded-lg border border-green-900/50 overflow-hidden"
      style={{
        boxShadow: "0 0 30px rgba(34, 197, 94, 0.15), inset 0 0 80px rgba(34, 197, 94, 0.08), 0 0 60px rgba(34, 197, 94, 0.1)",
      }}
    >
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 bg-green-950/40 border-b border-green-900/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50" />
          <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
        </div>
        <div className="text-xs text-green-500/80 font-mono font-semibold tracking-wider">
          {isActive ? "● LIVE STREAM" : "○ TERMINAL"}
        </div>
      </div>

      {/* Terminal content */}
      <div
        ref={terminalRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto p-4 font-mono text-sm leading-relaxed"
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          textShadow: "0 0 10px rgba(34, 197, 94, 0.3)",
        }}
      >
        {logs.length === 0 ? (
          <div className="text-green-500/50 animate-pulse">
            [SYSTEM] Terminal ready. Waiting for audit stream...
          </div>
        ) : (
          logs.map((line, index) => (
            <div 
              key={index} 
              className={getLineColor(line)}
              style={{
                textShadow: line.startsWith("[FINDING]") 
                  ? "0 0 8px rgba(239, 68, 68, 0.6)" 
                  : line.startsWith("[STATUS]")
                  ? "0 0 8px rgba(250, 204, 21, 0.6)"
                  : line.startsWith("[LOG]")
                  ? "0 0 8px rgba(34, 197, 94, 0.6)"
                  : "none"
              }}
            >
              {line}
            </div>
          ))
        )}
      </div>

      {/* Scroll indicator */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (terminalRef.current) {
              terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-4 right-4 px-3 py-1 bg-green-900/40 text-green-500 text-xs rounded border border-green-900/60 hover:bg-green-900/60 transition-all shadow-lg shadow-green-900/30 font-mono"
        >
          ↓ Scroll to bottom
        </button>
      )}
    </div>
  );
}
