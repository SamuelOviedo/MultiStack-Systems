import { motion } from "framer-motion";
import { useState, useEffect } from "react";

const TerminalHero = () => {
  const [phase, setPhase] = useState(0);
  const [typedText, setTypedText] = useState("");
  const command = "npm install multistack-success";

  useEffect(() => {
    if (phase === 0) {
      let i = 0;
      const interval = setInterval(() => {
        setTypedText(command.slice(0, i + 1));
        i++;
        if (i >= command.length) {
          clearInterval(interval);
          setTimeout(() => setPhase(1), 400);
        }
      }, 80);
      return () => clearInterval(interval);
    }
    if (phase === 1) {
      setTimeout(() => setPhase(2), 2000);
    }
  }, [phase]);

  return (
    <div className="w-full max-w-2xl rounded-lg overflow-hidden glow-border bg-card/80 backdrop-blur-xl">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-foreground/5 bg-foreground/5">
        <div className="w-3 h-3 rounded-full bg-destructive/20 border border-destructive/50" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
        <div className="w-3 h-3 rounded-full bg-primary/20 border border-primary/50" />
        <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
          bash — 80×24
        </span>
      </div>
      {/* Content */}
      <div className="p-6 font-mono text-sm sm:text-base space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-primary">➜</span>
          <span className="text-accent">~</span>
          <span className="text-muted-foreground">{typedText}</span>
          {phase === 0 && (
            <span className="inline-block w-2 h-5 bg-primary animate-blink" />
          )}
        </div>

        {phase >= 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            <p className="text-primary/80"># MultiStack Systems Initialized</p>
            <p className="text-muted-foreground">
              Installing high_level_engineering...
            </p>
            <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.8, ease: "easeInOut" }}
                className="h-full bg-primary rounded-full"
              />
            </div>
          </motion.div>
        )}

        {phase >= 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-1"
          >
            <p className="text-primary">
              ✔ Success: Engineering DNA injected.
            </p>
            <p className="text-muted-foreground text-xs">
              added 42 packages in 2.1s
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default TerminalHero;
