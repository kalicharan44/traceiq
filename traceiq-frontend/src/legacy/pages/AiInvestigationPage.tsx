import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  ArrowRight,
  Bot,
  User,
  ShieldAlert,
  GitBranch,
  AlertTriangle
} from 'lucide-react';
import { useNexus, buildTraceabilityGraph } from '../context/NexusContext';
import { Badge } from '../components/Badge';

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  suggestedAction?: {
    label: string;
    tab: string;
    target?: string;
  };
}

export const AiInvestigationPage: React.FC = () => {
  const { db, setActiveTab, setGlobalSearchTarget } = useNexus();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'ai',
      content:
        "Hello. I am the TraceIQ AI Investigator.\n\nI can query our supply chain dataset for lot traceability paths, identify data anomalies, explain quantity discrepancies, and prepare draft recall reports. What would you like to investigate?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const suggestedPrompts = [
    'Trace RAW-1042 through the supply chain',
    'Find missing traceability links',
    'Explain quantity discrepancies',
    'Draft a recall incident report'
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      let aiResponse = '';
      let suggestedAction: ChatMessage['suggestedAction'];
      const lowerInput = userMsg.toLowerCase();

      const idMatch = userMsg.match(/([A-Z]+-\d+|RAW-MISSING)/i);
      const detectedId = idMatch ? idMatch[0].toUpperCase() : null;

      if (
        detectedId &&
        (lowerInput.includes('trace') || lowerInput.includes('affect') || lowerInput.includes(detectedId.toLowerCase()))
      ) {
        const impact = buildTraceabilityGraph(db, detectedId);
        if (impact) {
          const missingWarning =
            impact.missingLots.length > 0
              ? `\n\n⚠️ **Traceability Gap Detected:**\nThe following upstream links are missing from the system: **${impact.missingLots.join(', ')}**.`
              : '';
          aiResponse = `**Traceability Analysis for ${detectedId}:**\nI've analyzed the genealogy graph. The lot is connected to production orders **${
            impact.pos.join(', ') || 'none'
          }**, yielding finished goods **${impact.fgLots.join(', ') || 'none'}**.\n\nCurrently, there are **${
            impact.inventory.length
          }** inventory locations and **${impact.shipments.length}** shipments affected, exposing **${
            impact.customers.length
          }** customer accounts.${missingWarning}`;
          suggestedAction = {
            label: `Trace ${detectedId} in Lot Genealogy`,
            tab: 'traceability',
            target: detectedId
          };
        } else {
          aiResponse = `I could not locate **${detectedId}** in the current dataset. Please verify the ID.`;
        }
      } else if (lowerInput.includes('report') || lowerInput.includes('draft') || lowerInput.includes('recall')) {
        aiResponse = `**DRAFT RECALL INCIDENT REPORT**\n\n**Date:** ${new Date().toLocaleDateString()}\n**Trigger Event:** Quality deviation detected on suspect lot.\n\n**Action Required:** Immediate quarantine of active stock in WH-East and WH-West, and issue return notices to affected commercial customers.\n\n*Note: This is a generated template based on current state. Navigate to the Recall Command Center to officially authorize execution.*`;
        suggestedAction = {
          label: 'Open Recall Command Center',
          tab: 'recall',
          target: 'RAW-1042'
        };
      } else if (
        lowerInput.includes('anomaly') ||
        lowerInput.includes('gap') ||
        lowerInput.includes('missing') ||
        lowerInput.includes('discrepanc') ||
        lowerInput.includes('over-allocation')
      ) {
        aiResponse = `I've detected two primary discrepancies in the dataset:\n\n1. **Orphaned Input (PO-9999):** Finished good FG-4001 was produced using \`RAW-MISSING\`, which lacks a valid supplier registry entry.\n2. **Quantity Over-Allocation (SHP-003):** Shipment SHP-003 shows 500 units of FG-4001 delivered to Gamma Healthcare, but production order PO-9999 only yielded 200 units (+300 units ghost mass).\n\nReview the Anomaly Detection module for technical details.`;
        suggestedAction = {
          label: 'Review Anomaly Detection',
          tab: 'anomalies'
        };
      } else {
        aiResponse =
          "I am analyzing the network for your request. Based on the current deterministic state, operations outside the known anomaly zones are nominal. Could you provide a specific Lot ID (e.g., RAW-1042) or refine your query?";
      }

      setIsTyping(false);
      setMessages((prev) => [...prev, { role: 'ai', content: aiResponse, suggestedAction }]);
    }, 750);
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8.5rem)] flex flex-col space-y-4 animate-in fade-in duration-300">
      {/* Title & Engine Label */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="p-2 bg-violet-50 border border-violet-200 rounded-xl text-violet-700">
              <Sparkles className="h-5 w-5" />
            </div>
            AI Investigation Assistant
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Query the supply chain graph for lot traceability, anomaly summaries, and draft reports.
          </p>
        </div>

        <Badge status="VIOLET" size="sm">SIMULATED ASSISTANT</Badge>
      </div>

      {/* Main Chat Container on White Surface */}
      <div className="flex-1 flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 bg-slate-50/40">
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={idx}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700 border border-violet-200 shrink-0 mt-0.5 shadow-2xs">
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap shadow-2xs ${
                    isUser
                      ? 'bg-blue-50 text-blue-950 border border-blue-200 rounded-br-sm'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm font-normal'
                  }`}
                >
                  {msg.content}

                  {/* Contextual Action Button inside assistant message */}
                  {msg.suggestedAction && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-3xs text-slate-500 font-medium">Recommended Action:</span>
                      <button
                        onClick={() => {
                          if (msg.suggestedAction?.target) {
                            setGlobalSearchTarget(msg.suggestedAction.target);
                          }
                          setActiveTab(msg.suggestedAction!.tab);
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1 text-2xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors"
                      >
                        {msg.suggestedAction.label}
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 border border-blue-200 text-blue-700 shrink-0 mt-0.5 shadow-2xs">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isTyping && (
            <div className="flex gap-3 justify-start">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700 border border-violet-200 shrink-0">
                <Sparkles className="h-4 w-4 animate-spin" />
              </div>
              <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white p-3.5 text-xs text-violet-800 flex items-center gap-2 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
                Analyzing supply chain graph and validating mass balance equations...
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Suggested Prompts Strip */}
        <div className="p-3 border-t border-slate-100 bg-white overflow-x-auto">
          <div className="flex gap-2">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => setInput(prompt)}
                className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-3xs font-medium text-slate-700 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-all shadow-2xs shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-slate-200">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask the AI investigator (e.g. Trace RAW-1042 through the supply chain)..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-4 pr-12 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 text-3xs text-slate-400 text-center">
            Simulated local rule-based investigation assistant.
          </div>
        </div>
      </div>
    </div>
  );
};
