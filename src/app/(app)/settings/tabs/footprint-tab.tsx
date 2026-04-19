"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Fingerprint, Search, Mail, Phone, UserCheck, Globe, Shield, Activity, AlertTriangle, Users, BarChart3, TrendingUp, Scan } from "lucide-react";
import { SettingsCard, SettingsCardHeader } from "./settings-primitives";

export function FootprintTab() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Fingerprint className="h-5 w-5" style={{ color: "var(--accent)" }} />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Digital Footprint</h2>
          <span className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full" style={{ background: "var(--brand-gradient)" }}>PRO</span>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          See your entire digital presence — the known and unknown. Find every account, mention, and trace linked to your identity.
        </p>
      </div>

      {/* Scanner */}
      <SettingsCard>
        <SettingsCardHeader
          title="Identity Scanner"
          icon={<Search className="h-4 w-4" style={{ color: "var(--accent)" }} />}
          description="Scan the web for accounts and data associated with your email, phone number, name, and usernames. Similar to services like Incogni but more comprehensive."
        />
        <div className="space-y-3 mb-4">
          {[
            { icon: Mail, label: "Email addresses", desc: "Find accounts registered with your emails", status: "Not scanned" },
            { icon: Phone, label: "Phone numbers", desc: "Discover accounts linked to your phone", status: "Not scanned" },
            { icon: UserCheck, label: "Usernames & names", desc: "Search for your name and aliases across platforms", status: "Not scanned" },
            { icon: Globe, label: "Data brokers", desc: "Check if your info appears on data broker sites", status: "Not scanned" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl glass-surface">
              <div className="h-9 w-9 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center flex-shrink-0">
                <item.icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-[var(--text-primary)] block">{item.label}</span>
                <span className="text-xs text-[var(--text-muted)]">{item.desc}</span>
              </div>
              <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">{item.status}</span>
            </div>
          ))}
        </div>
        <Button variant="gradient" className="w-full">
          <Scan className="h-4 w-4 mr-2" /> Run Full Scan
        </Button>
      </SettingsCard>

      {/* Footprint overview */}
      <SettingsCard>
        <SettingsCardHeader title="Footprint Overview" icon={<BarChart3 className="h-4 w-4" style={{ color: "var(--accent)" }} />} />
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: "Known accounts", value: "--", icon: Users, color: "text-[var(--accent)]" },
            { label: "Data exposures", value: "--", icon: AlertTriangle, color: "text-amber-400" },
            { label: "Privacy score", value: "--", icon: Shield, color: "text-emerald-400" },
            { label: "Risk level", value: "--", icon: Activity, color: "text-cyan-400" },
          ].map((stat) => (
            <div key={stat.label} className="p-3 rounded-xl glass-surface text-center">
              <stat.icon className={`h-5 w-5 mx-auto mb-1 ${stat.color}`} />
              <span className="text-lg font-bold text-[var(--text-primary)] block">{stat.value}</span>
              <span className="text-[10px] text-[var(--text-muted)]">{stat.label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)] text-center">Run a scan to populate your footprint overview</p>
      </SettingsCard>

      {/* Cross-platform analytics */}
      <SettingsCard>
        <SettingsCardHeader
          title="Cross-Platform Analytics"
          icon={<TrendingUp className="h-4 w-4" style={{ color: "var(--accent)" }} />}
          description="In-depth stats on your digital presence across all connected platforms — engagement trends, follower growth, content performance, and audience demographics."
          className="mb-3"
        />
        <div className="space-y-2">
          {[
            { label: "Total reach across platforms", value: "--" },
            { label: "Engagement rate (avg)", value: "--" },
            { label: "Content published (30 days)", value: "--" },
            { label: "Follower growth (30 days)", value: "--" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-[var(--border-primary)] last:border-0">
              <span className="text-xs text-[var(--text-secondary)]">{item.label}</span>
              <span className="text-sm font-medium text-[var(--text-primary)]">{item.value}</span>
            </div>
          ))}
        </div>
      </SettingsCard>
    </motion.div>
  );
}
