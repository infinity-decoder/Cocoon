/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { ArrowUpRight, ArrowDownRight, ShieldCheck } from 'lucide-react';
import AnimatedTicker from './AnimatedTicker';

interface QuickStatsProps {
  income: number;
  expenses: number;
  savings: number;
  currencySymbol?: string;
  themeCardBg: string;
  themeBorder: string;
  themeRadius: string;
}

export default function QuickStats({
  income,
  expenses,
  savings,
  currencySymbol = '$',
  themeCardBg,
  themeBorder,
  themeRadius
}: QuickStatsProps) {
  const stats = [
    {
      title: 'Total Income',
      amount: income,
      icon: ArrowUpRight,
      iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      labelColor: 'text-emerald-400'
    },
    {
      title: 'Total Expenses',
      amount: expenses,
      icon: ArrowDownRight,
      iconColor: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
      labelColor: 'text-rose-400'
    },
    {
      title: 'Savings Vault',
      amount: savings,
      icon: ShieldCheck,
      iconColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
      labelColor: 'text-indigo-400'
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, x: 50, scale: 0.95 },
    show: { 
      opacity: 1, 
      x: 0, 
      scale: 1,
      transition: { 
        type: 'spring', 
        stiffness: 120, 
        damping: 15 
      }
    }
  };

  return (
    <div className="w-full flex flex-col gap-1 select-none">
      <span className="text-xs font-semibold tracking-wider opacity-60 uppercase px-1">
        Financial Standings
      </span>

      {/* Horizontal Scrollable Row */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex gap-3 overflow-x-auto scrollbar-none py-1 px-1 -mx-1"
      >
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={idx}
              variants={cardVariants}
              whileHover={{ y: -4, scale: 1.02 }}
              className="flex-shrink-0 w-48 p-4 relative overflow-hidden flex flex-col gap-3 shadow-lg"
              style={{
                backgroundColor: themeCardBg,
                border: `1px solid ${themeBorder}`,
                borderRadius: themeRadius.replace('rounded-', '') || '24px'
              }}
            >
              {/* Blur background circles */}
              <div className="absolute top-[-20px] right-[-20px] w-16 h-16 rounded-full bg-white/2 opacity-[0.03] blur-xl pointer-events-none" />

              <div className="flex items-center justify-between">
                <span className="text-xs font-light tracking-wide opacity-50">
                  {stat.title}
                </span>
                <div className={`p-1.5 rounded-full border ${stat.iconColor}`}>
                  <Icon size={16} />
                </div>
              </div>

              <div className="flex flex-col">
                <AnimatedTicker
                  value={stat.amount}
                  currencySymbol={currencySymbol}
                  className="text-lg font-bold tracking-tight"
                />
                <span className={`text-[9px] font-mono opacity-60 mt-0.5 ${stat.labelColor}`}>
                  Active Balance
                </span>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
