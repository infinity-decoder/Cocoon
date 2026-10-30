/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Globe, Briefcase, LifeBuoy, Send, Twitter, 
  MessageSquare, Facebook, Instagram, Linkedin, Youtube, 
  ExternalLink, Terminal, Copy, Check, Sparkles, Heart
} from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface AboutAuthorModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: AppTheme;
}

interface AuthorLink {
  title: string;
  subtitle: string;
  url: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  accentColor: string;
  badge?: string;
}

const AUTHOR_LINKS: AuthorLink[] = [
  {
    title: 'Official Website',
    subtitle: 'infinitydecoder.com',
    url: 'https://infinitydecoder.com/',
    icon: Globe,
    accentColor: '#3B82F6',
    badge: 'Main'
  },
  {
    title: 'Portfolio & Works',
    subtitle: 'profile.infinitydecoder.com',
    url: 'https://profile.infinitydecoder.com/',
    icon: Briefcase,
    accentColor: '#8B5CF6',
    badge: 'Showcase'
  },
  {
    title: 'Support Portal',
    subtitle: 'support.infinitydecoder.com',
    url: 'https://support.infinitydecoder.com/',
    icon: LifeBuoy,
    accentColor: '#10B981',
    badge: '24/7'
  },
  {
    title: 'Telegram Channel',
    subtitle: '@Infinity_Decoder',
    url: 'https://t.me/Infinity_Decoder',
    icon: Send,
    accentColor: '#229ED9'
  },
  {
    title: 'Twitter / X',
    subtitle: '@DecoderInfinity',
    url: 'https://twitter.com/DecoderInfinity',
    icon: Twitter,
    accentColor: '#1DA1F2'
  },
  {
    title: 'WhatsApp Contact',
    subtitle: 'Direct Message',
    url: 'https://wa.me/message/Z7OPYG2QQ7FRI1',
    icon: MessageSquare,
    accentColor: '#25D366'
  },
  {
    title: 'LinkedIn Showcase',
    subtitle: 'infinity-decoder',
    url: 'https://www.linkedin.com/showcase/infinity-decoder/',
    icon: Linkedin,
    accentColor: '#0A66C2'
  },
  {
    title: 'YouTube Channel',
    subtitle: '@decoderinfinity',
    url: 'https://www.youtube.com/@decoderinfinity',
    icon: Youtube,
    accentColor: '#FF0000'
  },
  {
    title: 'Facebook Page',
    subtitle: 'DecoderInfinity',
    url: 'https://www.facebook.com/DecoderInfinity/',
    icon: Facebook,
    accentColor: '#1877F2'
  },
  {
    title: 'Instagram',
    subtitle: '@decoderinfinity',
    url: 'https://www.instagram.com/decoderinfinity/',
    icon: Instagram,
    accentColor: '#E1306C'
  }
];

export default function AboutAuthorModal({ isOpen, onClose, theme }: AboutAuthorModalProps) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    triggerHapticFeedback();
    navigator.clipboard?.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 select-none">
        {/* Glassmorphic Backdrop Scrim */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            triggerHapticFeedback();
            onClose();
          }}
          className="absolute inset-0 backdrop-blur-md cursor-pointer"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}
        />

        {/* Modal Sheet with Frosted Glassmorphism */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="relative w-full max-w-md max-h-[88vh] rounded-[32px] border flex flex-col overflow-hidden shadow-2xl z-10 text-left"
          style={{
            backgroundColor: theme.isDark ? 'rgba(17, 31, 73, 0.90)' : 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            borderColor: theme.borderSubtle,
            color: theme.textPrimary
          }}
        >
          {/* Ambient Decorative Glow behind avatar */}
          <div 
            className="absolute -top-16 -left-16 w-48 h-48 rounded-full pointer-events-none opacity-30 blur-3xl"
            style={{ backgroundColor: theme.primary }}
          />
          <div 
            className="absolute top-20 -right-16 w-44 h-44 rounded-full pointer-events-none opacity-20 blur-3xl"
            style={{ backgroundColor: '#D946EF' }}
          />

          {/* Header Bar */}
          <div 
            className="flex items-center justify-between px-5 pt-4 pb-3 border-b shrink-0 z-10"
            style={{ borderColor: theme.borderSubtle }}
          >
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg border flex items-center justify-center" style={{ backgroundColor: `${theme.primary}20`, borderColor: `${theme.primary}40` }}>
                <Sparkles size={14} style={{ color: theme.primary }} />
              </span>
              <span className="text-[11px] font-mono tracking-widest font-black uppercase" style={{ color: theme.primary }}>
                Creator & Architect
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback();
                onClose();
              }}
              className="w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer active:scale-95"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.borderSubtle,
                color: theme.textSecondary
              }}
              title="Close Profile"
            >
              <X size={16} />
            </button>
          </div>

          {/* Profile Card Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-none z-10">
            {/* Top Identity Block */}
            <div 
              className="p-4 rounded-2xl border flex flex-col items-center text-center relative overflow-hidden transition-all shadow-sm"
              style={{
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle
              }}
            >
              {/* Outer Glowing Avatar Ring */}
              <div 
                className="relative p-1.5 rounded-2xl border shadow-xl flex items-center justify-center mb-3 group"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: `${theme.primary}50`,
                  boxShadow: `0 8px 24px ${theme.primary}25`
                }}
              >
                <div className="w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center bg-white p-2">
                  <img
                    src="/assets/aistudio/infinity_logo_v_01_599892f8.png"
                    alt="INFINITY DECODER"
                    className="w-full h-full object-contain filter drop-shadow-md group-hover:scale-105 transition-transform"
                  />
                </div>
              </div>

              {/* Author Title */}
              <h2 className="text-lg font-black tracking-tight" style={{ color: theme.textPrimary }}>
                INFINITY DECODER
              </h2>

              {/* Required Bio (without writing the word "bio") */}
              <div 
                className="mt-2.5 px-3.5 py-2 rounded-xl border flex items-center gap-2 max-w-sm"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.borderSubtle
                }}
              >
                <Terminal size={14} className="shrink-0" style={{ color: theme.primary }} />
                <p className="text-xs font-mono font-semibold tracking-tight text-left leading-relaxed" style={{ color: theme.textPrimary }}>
                  Terminal is my battleground &amp; Code flows in my DNA.🧬
                </p>
              </div>

              {/* Sub-badge: Software Architect */}
              <div className="flex items-center gap-1.5 mt-3 text-[10px] font-mono" style={{ color: theme.textSecondary }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.primary }} />
                <span>Lead Software Engineer &amp; Designer</span>
              </div>
            </div>

            {/* Links Section Header */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-mono uppercase tracking-wider font-bold" style={{ color: theme.textSecondary }}>
                Official Links &amp; Communities ({AUTHOR_LINKS.length})
              </span>
              <span className="text-[10px] font-mono" style={{ color: theme.textMuted }}>
                Tap to visit
              </span>
            </div>

            {/* List of Platform Links */}
            <div className="space-y-2">
              {AUTHOR_LINKS.map((link) => {
                const IconComponent = link.icon;
                const isCopied = copiedUrl === link.url;

                return (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => triggerHapticFeedback()}
                    className="flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer group active:scale-[0.98] shadow-sm hover:translate-y-[-1px]"
                    style={{
                      backgroundColor: theme.surfaceElevated,
                      borderColor: theme.borderSubtle
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div 
                        className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                        style={{
                          backgroundColor: `${link.accentColor}18`,
                          borderColor: `${link.accentColor}35`,
                          color: link.accentColor
                        }}
                      >
                        <IconComponent size={18} />
                      </div>

                      <div className="flex flex-col min-w-0 text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold truncate" style={{ color: theme.textPrimary }}>
                            {link.title}
                          </span>
                          {link.badge && (
                            <span 
                              className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full border shrink-0"
                              style={{
                                backgroundColor: `${link.accentColor}15`,
                                borderColor: `${link.accentColor}40`,
                                color: link.accentColor
                              }}
                            >
                              {link.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono truncate" style={{ color: theme.textMuted }}>
                          {link.subtitle}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={(e) => handleCopy(e, link.url)}
                        className="p-1.5 rounded-lg border transition-colors cursor-pointer"
                        style={{
                          backgroundColor: theme.surfaceMuted,
                          borderColor: theme.borderSubtle,
                          color: isCopied ? '#10B981' : theme.textSecondary
                        }}
                        title="Copy Link"
                      >
                        {isCopied ? <Check size={12} /> : <Copy size={12} />}
                      </button>

                      <div 
                        className="p-1.5 rounded-lg border group-hover:translate-x-0.5 transition-transform"
                        style={{
                          backgroundColor: theme.surfaceMuted,
                          borderColor: theme.borderSubtle,
                          color: theme.primary
                        }}
                      >
                        <ExternalLink size={12} />
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>

          {/* Footer Note */}
          <div 
            className="px-5 py-3 border-t flex items-center justify-center gap-1 text-[11px] font-mono shrink-0 z-10"
            style={{ 
              backgroundColor: theme.surfaceMuted, 
              borderColor: theme.borderSubtle,
              color: theme.textSecondary 
            }}
          >
            <span>Crafted with</span>
            <Heart size={12} className="text-red-500 fill-red-500 inline mx-0.5" />
            <span>for Cocoon Finance</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
