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
    if (line.startsWith("[FINDING]")) return "text-red-500 font-bold";
    if (line.startsWith("[STATUS]")) return "text-yellow-400";
    if (line.startsWith("[LOG]")) return "text-green-500";
    if (line.startsWith("[ERROR]")) return "text-red-600 font-bold";
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
        boxShadow: "0 0 20px rgba(34, 197, 94, 0.1), inset 0 0 60px rgba(34, 197, 94, 0.05)",
      }}
    >
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 bg-green-950/30 border-b border-green-900/50">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <div className="text-xs text-green-500/70 font-mono">
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
        }}
      >
        {logs.length === 0 ? (
          <div className="text-green-500/50">
            [SYSTEM] Terminal ready. Waiting for audit stream...
          </div>
        ) : (
          logs.map((line, index) => (
            <div key={index} className={getLineColor(line)}>
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
          className="absolute bottom-4 right-4 px-3 py-1 bg-green-900/30 text-green-500 text-xs rounded border border-green-900/50 hover:bg-green-900/50 transition-colors"
        >
          ↓ Scroll to bottom
        </button>
      )}
    </div>
  );
}
