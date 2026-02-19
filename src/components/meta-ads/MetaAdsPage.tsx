import { useState } from 'react';
import MetaAdsChat from './MetaAdsChat';
import MetaAdsDashboard from './MetaAdsDashboard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart3, MessageSquare, Users, Zap } from 'lucide-react';

export default function MetaAdsPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-zinc-100">
          <span className="text-blue-400">PTD</span> Meta Ads Intelligence
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">Qwen + Anthropic MCP \u2022 Dual AI Pipeline</p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard" className="gap-1.5 cursor-pointer">
            <BarChart3 className="w-3.5 h-3.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-1.5 cursor-pointer">
            <MessageSquare className="w-3.5 h-3.5" /> AI Chat
          </TabsTrigger>
          <TabsTrigger value="audience" className="gap-1.5 cursor-pointer">
            <Users className="w-3.5 h-3.5" /> Audience
          </TabsTrigger>
          <TabsTrigger value="tokens" className="gap-1.5 cursor-pointer">
            <Zap className="w-3.5 h-3.5" /> Token Budget
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <MetaAdsDashboard />
        </TabsContent>

        <TabsContent value="chat" className="h-[calc(100vh-12rem)]">
          <MetaAdsChat />
        </TabsContent>

        <TabsContent value="audience">
          <div className="text-center py-12 text-sm text-zinc-500">
            <Users className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
            <p>Audience breakdown loads from the Dashboard tab.</p>
            <p className="text-xs mt-1">Use the AI Chat to ask for detailed audience analysis.</p>
          </div>
        </TabsContent>

        <TabsContent value="tokens">
          <div className="text-center py-12 text-sm text-zinc-500">
            <Zap className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
            <p>Token budget details are available in the Dashboard &rarr; Tokens tab.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
