import React, { useState, useEffect } from 'react';
import { 
  Play, 
  CheckCircle2, 
  Users, 
  FileText, 
  Trophy, 
  BookOpen, 
  MessageSquare, 
  Package, 
  Calendar,
  ChevronRight,
  Star,
  Download,
  Award,
  Zap,
  Search,
  Filter,
  ArrowRight,
  Layout,
  Target,
  Clock,
  Circle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AgentProfile, Milestone, Resource, ResourceCategory, RoadmapWeek, SuccessStory, Challenge } from './types';
import BlueprintDocsPage from './pages/BlueprintDocsPage';
import AIStudioPage from './pages/AIStudioPage';
import LandingPage from './pages/LandingPage';
import PricingPage, { PricingPlanId } from './pages/PricingPage';
import OAuthLoginPage, { AuthenticatedMember } from './pages/OAuthLoginPage';
import Profile from './components/Profile';
import AdminWorkspace from './pages/AdminWorkspace';
import agentProfileAvatar from './assets/images/avatar_agent_profile_1795586852526.jpg';
import {
  completeAuthCallbackFromUrl,
  getSupabaseBrowserClient,
  getVerifiedAccessToken,
  signOutSupabase,
} from './lib/supabase';

const INITIAL_PROFILE: AgentProfile = {
  name: 'Jason Feimster',
  role: 'Elite Agent · Inner Circle',
  email: 'jasonfeimster@gmail.com',
  territory: 'West Coast Luxury Markets',
  cohort: 'Cohort Q4 2026',
  mentorName: 'David Sterling',
  bio: 'Luxury capital and real estate advisor focused on high-net-worth private placements, off-market acquisitions, and relationship-led deal execution.',
  avatar: agentProfileAvatar,
};

// Mock Data
const INITIAL_MILESTONES: Milestone[] = [
  { id: '1', title: 'First Lead', description: 'Generate your first qualified lead in the system.', completed: true, icon: 'Users' },
  { id: '2', title: 'First Deal', description: 'Close your first property transaction.', completed: false, icon: 'FileText' },
  { id: '3', title: 'First Commission', description: 'Receive your first payout from Moonshine Capital.', completed: false, icon: 'Award' },
];

const SUCCESS_STORIES: SuccessStory[] = [
  { id: '1', agentName: 'Sarah Jenkins', achievement: 'Closed $2M deal in first 2 weeks!', avatar: 'https://i.pravatar.cc/150?u=sarah', timestamp: '2h ago' },
  { id: '2', agentName: 'Marcus Thorne', achievement: 'Reached Platinum Status', avatar: 'https://i.pravatar.cc/150?u=marcus', timestamp: '5h ago' },
  { id: '3', agentName: 'Elena Rodriguez', achievement: '10th successful closing this month', avatar: 'https://i.pravatar.cc/150?u=elena', timestamp: '1d ago' },
];

const INITIAL_CHALLENGES: Challenge[] = [
  { id: '1', title: 'Complete Profile', reward: 'Moonshine Badge', points: 50, completed: true },
  { id: '2', title: 'Watch Intro Video', reward: 'Early Access', points: 100, completed: true },
  { id: '3', title: 'Join Community', reward: 'Network Points', points: 75, completed: false },
];

const RESOURCE_CATEGORIES: ResourceCategory[] = [
  { id: 'prod', name: 'Product Knowledge', icon: 'Layout', description: 'Deep dives into Moonshine assets and market positioning.' },
  { id: 'sales', name: 'Sales Strategy', icon: 'Target', description: 'Advanced negotiation and conversion techniques for elite clients.' },
  { id: 'crm', name: 'CRM Training', icon: 'Users', description: 'Mastering the tools that power your pipeline.' },
  { id: 'mkt', name: 'Marketing Tools', icon: 'Zap', description: 'Leveraging the brand vault for maximum visibility.' },
];

const RESOURCES: Resource[] = [
  { 
    id: '1', 
    title: 'The Moonshine Standard', 
    category: 'prod', 
    thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=400',
    duration: '12:40',
    learningObjectives: ['Understand brand ethos', 'Identify target demographics', 'Master luxury positioning']
  },
  { 
    id: '2', 
    title: 'High-Net-Worth Networking', 
    category: 'sales', 
    thumbnail: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=400',
    duration: '15:20',
    learningObjectives: ['Event networking strategies', 'Referral loop creation', 'Building long-term trust']
  },
  { 
    id: '3', 
    title: 'Mastering the Moonshine CRM', 
    category: 'crm', 
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=400',
    duration: '08:15',
    learningObjectives: ['Lead scoring setup', 'Automated follow-up sequences', 'Pipeline visualization']
  },
  { 
    id: '4', 
    title: 'Leveraging the Marketing Vault', 
    category: 'mkt', 
    thumbnail: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=400',
    duration: '10:30',
    learningObjectives: ['Template customization', 'Social media scheduling', 'Brand alignment checks']
  },
  { 
    id: '5', 
    title: 'Closing the $10M+ Deal', 
    category: 'sales', 
    thumbnail: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=400',
    duration: '18:45',
    learningObjectives: ['Advanced negotiation tactics', 'Legal walkthroughs', 'Escrow management']
  },
  { 
    id: '6', 
    title: 'Property Valuation for Luxury Assets', 
    category: 'prod', 
    thumbnail: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=400',
    duration: '14:10',
    learningObjectives: ['Technical appraisal methods', 'Market comparison analysis', 'Unique asset highlighting']
  },
];

const ROADMAP: RoadmapWeek[] = [
  {
    week: 1,
    theme: 'Foundation & Identity',
    objective: 'Complete profile, brand alignment, and tool setup.',
    steps: [
      { id: 'w1-1', title: 'Complete Elite Profile Bio', isAction: true, completed: true },
      { id: 'w1-2', title: 'Schedule Professional Headshots', isAction: true, completed: true },
      { id: 'w1-3', title: 'Initial CRM Configuration', isAction: true, completed: true },
      { id: 'w1-4', title: 'Review Brand Identity Guide', isAction: false, completed: true },
    ]
  },
  {
    week: 2,
    theme: 'Product & Market Mastery',
    objective: 'Deep dive into current listings and market trends.',
    steps: [
      { id: 'w2-1', title: 'Study Top 5 Active Listings', isAction: false, completed: false },
      { id: 'w2-2', title: 'Attend 2 Property Walkthroughs', isAction: true, completed: false },
      { id: 'w2-3', title: 'Generate Local Market Report', isAction: true, completed: false },
      { id: 'w2-4', title: 'Product Knowledge Quiz', isAction: true, completed: false },
    ]
  },
  {
    week: 3,
    theme: 'Outreach & Momentum',
    objective: 'Initiate first 20 outreach calls/emails.',
    steps: [
      { id: 'w3-1', title: 'Script Practice with Mentor', isAction: true, completed: false },
      { id: 'w3-2', title: 'Generate Lead List (20+)', isAction: true, completed: false },
      { id: 'w3-3', title: 'First 5 Discovery Calls', isAction: true, completed: false },
      { id: 'w3-4', title: 'Setup Email Sequences', isAction: true, completed: false },
    ]
  },
  {
    week: 4,
    theme: 'Pipeline & Conversion',
    objective: 'Secure first qualified lead and schedule a viewing.',
    steps: [
      { id: 'w4-1', title: 'Follow-up Sequence Execution', isAction: true, completed: false },
      { id: 'w4-2', title: 'Coordinate First Property Viewing', isAction: true, completed: false },
      { id: 'w4-3', title: 'Mentor Feedback Session', isAction: true, completed: false },
      { id: 'w4-4', title: 'Monthly Performance Review', isAction: false, completed: false },
    ]
  }
];

export default function App() {
  const [authScreen, setAuthScreen] = useState<'landing' | 'pricing' | 'login' | 'portal'>(() =>
    typeof window !== 'undefined' && window.location.pathname === '/pricing' ? 'pricing' : 'landing'
  );
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [memberRole, setMemberRole] = useState<'member' | 'admin'>('member');
  const [currentPlanId, setCurrentPlanId] = useState<PricingPlanId | null>(null);
  const [pendingOnboarding, setPendingOnboarding] = useState<{
    userId: string;
    email: string;
    accessToken: string;
  } | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'dashboard' | 'roadmap' | 'resources' | 'studio' | 'docs' | 'profile' | 'admin'>('dashboard');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [agentProfile, setAgentProfile] = useState<AgentProfile>(INITIAL_PROFILE);
  const [milestones, setMilestones] = useState<Milestone[]>(INITIAL_MILESTONES);
  const [roadmap, setRoadmap] = useState<RoadmapWeek[]>(ROADMAP);
  const [challenges, setChallenges] = useState<Challenge[]>(INITIAL_CHALLENGES);

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      const url = new URL(window.location.href);
      const isAuthCallbackAttempt =
        url.pathname === '/auth/callback' ||
        url.searchParams.has('code') ||
        url.searchParams.has('token_hash');

      try {
        const callbackSession = await completeAuthCallbackFromUrl();
        const token = callbackSession?.access_token ?? (await getVerifiedAccessToken());
        if (!token || !active) return;

        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || !active) return;
        const data = await res.json().catch(() => null);
        if (!data || !active) return;

        if (data.onboarded && data.membershipStatus === 'active' && data.account) {
          setMemberRole(data.account.role === 'admin' ? 'admin' : 'member');
          setAccessToken(token);
          setCurrentPlanId(data.account.plan?.id ?? null);
          setPendingOnboarding(null);
          setAgentProfile((prev) => ({
            ...prev,
            email: data.account.email,
            name: data.account.name || prev.name,
            role: data.account.role === 'admin' ? 'Managing Partner · Admin' : 'Inner Circle · Member',
          }));
          if (url.pathname !== '/pricing') {
            setAuthScreen('portal');
          }
        } else if (data.authenticated && !data.onboarded && data.user) {
          setAccessToken(null);
          setPendingOnboarding({
            userId: data.user.id,
            email: data.user.email,
            accessToken: token,
          });
          setAuthNotice(
            `Email verified for ${data.user.email}. Enter your approved invitation code to activate your membership.`
          );
          setAuthScreen('login');
        }
      } catch (err) {
        if (!active || !isAuthCallbackAttempt) return;
        setAuthNotice(
          err instanceof Error ? err.message : 'Sign-in link expired or invalid. Please request a new code.'
        );
        setAuthScreen('login');
      }
    };

    verifySession();

    let unsubscribe: (() => void) | undefined;
    try {
      const client = getSupabaseBrowserClient();
      const subscription = client?.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          setAccessToken(null);
          setPendingOnboarding(null);
          setAuthScreen('landing');
        } else if (event === 'TOKEN_REFRESHED' && session?.access_token) {
          setAccessToken(session.access_token);
        }
      });
      unsubscribe = () => subscription?.data.subscription.unsubscribe();
    } catch {
      // Auth listener unavailable; public landing page remains accessible.
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const handleAuthenticated = (member: AuthenticatedMember) => {
    setMemberRole(member.role);
    setAccessToken(member.accessToken);
    setPendingOnboarding(null);
    setAuthNotice(null);
    setAgentProfile((prev) => ({
      ...prev,
      email: member.email,
      name: member.name || prev.name,
      role: member.role === 'admin' ? 'Managing Partner · Admin' : 'Inner Circle · Member',
    }));
    setActiveView('dashboard');
    setAuthScreen('portal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignOut = async () => {
    await signOutSupabase().catch(() => {});
    setAccessToken(null);
    setMemberRole('member');
    setCurrentPlanId(null);
    setPendingOnboarding(null);
    setAuthNotice(null);
    setAuthScreen('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openPublicScreen = (screen: 'landing' | 'pricing' | 'login', scrollToApply = false) => {
    setAuthScreen(screen);
    if (typeof window !== 'undefined') {
      const nextPath = screen === 'pricing' ? '/pricing' : '/';
      if (window.location.pathname !== nextPath) {
        window.history.replaceState({}, document.title, nextPath);
      }
    }
    if (scrollToApply) {
      setTimeout(() => {
        document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const filteredResources = selectedCategory 
    ? RESOURCES.filter(r => r.category === selectedCategory)
    : RESOURCES;

  const earnedChallengePoints = challenges
    .filter(c => c.completed)
    .reduce((sum, c) => sum + c.points, 0);

  const handleToggleMilestone = (milestoneId: string) => {
    setMilestones(prev =>
      prev.map(m => (m.id === milestoneId ? { ...m, completed: !m.completed } : m))
    );
  };

  const handleToggleChallenge = (challengeId: string) => {
    setChallenges(prev =>
      prev.map(c => (c.id === challengeId ? { ...c, completed: !c.completed } : c))
    );
  };

  const handleToggleRoadmapStep = (weekNum: number, stepId: string) => {
    setRoadmap(prev =>
      prev.map(w =>
        w.week === weekNum
          ? {
              ...w,
              steps: w.steps.map(s =>
                s.id === stepId ? { ...s, completed: !s.completed } : s
              ),
            }
          : w
      )
    );
  };

  if (authScreen === 'landing') {
    return (
      <LandingPage
        onOpenLogin={() => openPublicScreen('login')}
        onOpenPricing={() => openPublicScreen('pricing')}
      />
    );
  }

  if (authScreen === 'pricing') {
    return (
      <PricingPage
        isAuthenticated={Boolean(accessToken)}
        currentPlanId={currentPlanId}
        onBackToLanding={() => openPublicScreen('landing')}
        onRequestInvite={() => openPublicScreen('landing', true)}
        onOpenLogin={() => openPublicScreen('login')}
        onOpenStudio={() => {
          setActiveView('studio');
          setAuthScreen('portal');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  if (authScreen === 'login') {
    return (
      <OAuthLoginPage
        defaultEmail={agentProfile.email}
        defaultName={agentProfile.name}
        initialPendingSession={pendingOnboarding}
        initialNotice={authNotice}
        onBackToLanding={() => openPublicScreen('landing')}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return (
    <div className="min-h-screen bg-elite-black text-white selection:bg-gold selection:text-elite-black font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/5 px-6 py-3.5 flex justify-between items-center gap-8">
        <button
          type="button"
          className="flex items-center gap-2.5 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-full"
          onClick={() => setActiveView('dashboard')}
        >
          <div className="w-8 h-8 gold-gradient rounded-full flex items-center justify-center shadow-lg">
            <span className="text-elite-black font-bold text-xs">MC</span>
          </div>
          <span className="font-display text-xl tracking-widest text-gold uppercase">Moonshine Capital</span>
        </button>
        <div className="hidden md:flex items-center gap-7 text-sm font-medium tracking-wide text-white/65">
          <button 
            type="button"
            onClick={() => setActiveView('dashboard')}
            className={`hover:text-gold transition-colors whitespace-nowrap shrink-0 ${activeView === 'dashboard' ? 'text-gold' : ''}`}
          >
            Dashboard
          </button>
          <button 
            type="button"
            onClick={() => setActiveView('roadmap')}
            className={`hover:text-gold transition-colors whitespace-nowrap shrink-0 ${activeView === 'roadmap' ? 'text-gold' : ''}`}
          >
            Roadmap
          </button>
          <button 
            type="button"
            onClick={() => setActiveView('resources')}
            className={`hover:text-gold transition-colors whitespace-nowrap shrink-0 ${activeView === 'resources' ? 'text-gold' : ''}`}
          >
            Resources
          </button>
          <button 
            type="button"
            onClick={() => setActiveView('studio')}
            className={`hover:text-gold transition-colors whitespace-nowrap shrink-0 ${activeView === 'studio' ? 'text-gold' : ''}`}
          >
            AI Studio
          </button>
          <button 
            type="button"
            onClick={() => setActiveView('docs')}
            className={`hover:text-gold transition-colors whitespace-nowrap shrink-0 ${activeView === 'docs' ? 'text-gold' : ''}`}
          >
            Docs
          </button>
          {memberRole === 'admin' && <button type="button" onClick={() => setActiveView('admin')}
            className={`hover:text-gold transition-colors whitespace-nowrap shrink-0 ${activeView === 'admin' ? 'text-gold' : ''}`}>
            Admin
          </button>}
        </div>
        {memberRole === 'admin' && <button type="button" onClick={() => setActiveView('admin')}
          className="md:hidden text-xs uppercase tracking-widest text-gold">Admin</button>}
        <button
          type="button"
          onClick={() => setActiveView('profile')}
          aria-label="Open agent profile"
          aria-current={activeView === 'profile' ? 'page' : undefined}
          className={`flex items-center gap-3 pl-3 pr-1.5 py-1 rounded-full border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
            activeView === 'profile'
              ? 'border-gold/60 bg-gold/10'
              : 'border-white/10 hover:border-gold/40 hover:bg-white/5'
          }`}
        >
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-white leading-tight">{agentProfile.name}</p>
            <p className="text-[11px] text-gold/80 leading-tight">{agentProfile.role.split('·')[0].trim()}</p>
          </div>
          <img
            src={agentProfile.avatar}
            alt={agentProfile.name}
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-full object-cover border border-gold/40"
          />
        </button>
      </nav>

      <main className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {activeView === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Left Column: Welcome & Video */}
              <div className="lg:col-span-8 space-y-8">
                <section className="space-y-4">
                  <h1 className="text-5xl md:text-7xl font-display font-light leading-tight">
                    Welcome to the <span className="text-gold italic">Inner Circle</span>
                  </h1>
                  <p className="text-lg opacity-60 max-w-2xl font-light">
                    You've been selected for the Moonshine Capital network. Your journey to elite status begins here.
                  </p>
                </section>

                {/* Video Player */}
                <section className="relative aspect-video rounded-3xl overflow-hidden group shadow-2xl purple-glow">
                  <img 
                    src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1200" 
                    alt="Welcome Video Thumbnail" 
                    className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-elite-black via-transparent to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button className="w-20 h-20 rounded-full gold-gradient flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                      <Play className="text-elite-black fill-elite-black ml-1" size={32} />
                    </button>
                  </div>
                  <div className="absolute bottom-8 left-8">
                    <p className="text-xs uppercase tracking-[0.3em] text-gold font-bold mb-1">Personalized Message</p>
                    <h3 className="text-2xl font-display">Founder's Welcome & Strategy</h3>
                  </div>
                </section>

                {/* Quick Access Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div 
                    onClick={() => setActiveView('roadmap')}
                    className="glass p-8 rounded-3xl group cursor-pointer hover:border-gold/30 transition-all"
                  >
                    <Calendar className="text-gold mb-4" size={32} />
                    <h3 className="text-2xl font-display mb-2">30-Day Roadmap</h3>
                    <p className="text-sm opacity-50 mb-6">Your step-by-step guide to network integration and first closing.</p>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gold">
                      View Roadmap <ArrowRight size={14} />
                    </div>
                  </div>
                  <div 
                    onClick={() => setActiveView('resources')}
                    className="glass p-8 rounded-3xl group cursor-pointer hover:border-purple/30 transition-all"
                  >
                    <BookOpen className="text-purple mb-4" size={32} />
                    <h3 className="text-2xl font-display mb-2">Resource Center</h3>
                    <p className="text-sm opacity-50 mb-6">Access elite training modules, marketing vaults, and sales tools.</p>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-purple">
                      Enter Center <ArrowRight size={14} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Sidebar Stats & Feed */}
              <div className="lg:col-span-4 space-y-8">
                <section className="glass p-8 rounded-3xl space-y-6 border-gold/20">
                  <h3 className="text-xl font-display flex items-center gap-2">
                    <Trophy className="text-gold" size={20} />
                    Milestones
                  </h3>
                  <div className="space-y-6">
                    {milestones.map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => handleToggleMilestone(m.id)}
                        className="w-full text-left relative pl-8 border-l border-white/10 pb-6 last:pb-0 group"
                      >
                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-elite-black ${m.completed ? 'bg-green' : 'bg-white/20 group-hover:bg-gold/50 transition-colors'}`}>
                          {m.completed && <CheckCircle2 size={10} className="text-white absolute inset-0 m-auto" />}
                        </div>
                        <h4 className={`text-sm font-bold ${m.completed ? 'text-white' : 'opacity-40 group-hover:opacity-75 transition-opacity'}`}>{m.title}</h4>
                        <p className="text-xs opacity-40 mt-1">{m.description}</p>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="bg-purple/10 border border-purple/20 p-8 rounded-3xl space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-display flex items-center gap-2">
                      <Zap className="text-purple" size={20} />
                      Quick Wins
                    </h3>
                    <span className="text-xs font-semibold text-gold tabular-nums">{earnedChallengePoints} PTS</span>
                  </div>
                  <div className="space-y-3">
                    {challenges.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => handleToggleChallenge(c.id)}
                        className={`w-full text-left p-4 rounded-2xl flex justify-between items-center transition-colors cursor-pointer ${
                          c.completed ? 'bg-green/10 border border-green/25' : 'bg-white/5 hover:bg-white/10 border border-transparent'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium">{c.title}</p>
                          <p className="text-[10px] text-gold uppercase font-bold">{c.reward}</p>
                        </div>
                        <div className="text-right tabular-nums">
                          <p className={`text-xs font-bold ${c.completed ? 'text-green' : 'text-white'}`}>
                            {c.completed ? 'Done' : `+${c.points}`}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="relative overflow-hidden p-8 rounded-3xl gold-gradient group cursor-pointer">
                  <div className="relative z-10 text-elite-black">
                    <h3 className="text-xl font-display font-bold">Claim Your Swag Kit</h3>
                    <p className="text-xs font-medium opacity-70 mt-1">Exclusive Moonshine Capital apparel & tools.</p>
                    <div className="mt-6 flex items-center gap-2 font-bold text-xs uppercase tracking-widest">
                      Order Now <ChevronRight size={14} />
                    </div>
                  </div>
                  <Package className="absolute -right-4 -bottom-4 text-elite-black/10 w-32 h-32 group-hover:scale-110 transition-transform" />
                </section>
              </div>
            </motion.div>
          )}

          {activeView === 'roadmap' && (
            <motion.div 
              key="roadmap"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <div className="max-w-3xl">
                <h1 className="text-5xl font-display mb-4">30-Day <span className="text-gold italic">Elite Roadmap</span></h1>
                <p className="text-lg opacity-60 font-light">A comprehensive guide to your first month at Moonshine Capital. Each week is designed to build momentum and secure your first high-value closing.</p>
              </div>

              <div className="grid grid-cols-1 gap-12">
                {roadmap.map((week) => (
                  <div key={week.week} className="relative">
                    <div className="flex flex-col md:flex-row gap-8">
                      <div className="md:w-64 flex-shrink-0">
                        <div className="sticky top-32 space-y-4">
                          <div className="flex items-center gap-2">
                            <span className="text-5xl font-display text-gold opacity-20">0{week.week}</span>
                            <div className="h-px flex-1 bg-white/10" />
                          </div>
                          <h2 className="text-2xl font-display">{week.theme}</h2>
                          <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-[10px] uppercase tracking-widest text-gold font-bold mb-2">Weekly Objective</p>
                            <p className="text-xs opacity-60 leading-relaxed">{week.objective}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {week.steps.map((step) => (
                          <div 
                            key={step.id} 
                            className={`p-6 rounded-3xl border transition-all flex items-start gap-4 ${step.completed ? 'bg-green/10 border-green/30' : 'glass border-white/5 hover:border-gold/20'}`}
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleRoadmapStep(week.week, step.id)}
                              aria-label={`Toggle ${step.title}`}
                              className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${step.completed ? 'bg-green border-green' : 'border-white/20 hover:border-gold'}`}
                            >
                              {step.completed && <CheckCircle2 size={12} className="text-white" />}
                            </button>
                            <div className="flex-1">
                              <h4 className={`text-sm font-medium ${step.completed ? 'text-white' : 'opacity-80'}`}>{step.title}</h4>
                              <div className="mt-4 flex items-center justify-between">
                                <span className={`text-[10px] uppercase tracking-widest font-bold ${step.isAction ? 'text-gold' : 'text-purple'}`}>
                                  {step.isAction ? 'Action Required' : 'Knowledge Base'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleRoadmapStep(week.week, step.id)}
                                  className="text-[10px] uppercase tracking-widest font-bold opacity-50 hover:opacity-100 transition-opacity"
                                >
                                  {step.completed ? 'Completed' : 'Mark Done'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeView === 'resources' && (
            <motion.div 
              key="resources"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <div className="flex flex-col md:flex-row justify-between items-end gap-8">
                <div className="max-w-2xl">
                  <h1 className="text-5xl font-display mb-4">Resource <span className="text-purple italic">Vault</span></h1>
                  <p className="text-lg opacity-60 font-light">The definitive collection of Moonshine Capital intelligence. Master the market with our curated video tutorials and strategy guides.</p>
                </div>
                <div className="flex gap-2 p-1 bg-white/5 rounded-full border border-white/5">
                  <button 
                    onClick={() => setSelectedCategory(null)}
                    className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${!selectedCategory ? 'bg-white text-elite-black' : 'hover:bg-white/5'}`}
                  >
                    All
                  </button>
                  {RESOURCE_CATEGORIES.map(cat => (
                    <button 
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${selectedCategory === cat.id ? 'bg-white text-elite-black' : 'hover:bg-white/5'}`}
                    >
                      {cat.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Grid */}
              {!selectedCategory && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {RESOURCE_CATEGORIES.map(cat => (
                    <div 
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className="glass p-6 rounded-3xl cursor-pointer hover:border-white/20 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4 group-hover:bg-gold/10 transition-colors">
                        {cat.id === 'prod' && <Layout className="text-gold" size={24} />}
                        {cat.id === 'sales' && <Target className="text-purple" size={24} />}
                        {cat.id === 'crm' && <Users className="text-green" size={24} />}
                        {cat.id === 'mkt' && <Zap className="text-gold" size={24} />}
                      </div>
                      <h3 className="text-lg font-display mb-2">{cat.name}</h3>
                      <p className="text-xs opacity-40 leading-relaxed">{cat.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Video Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {filteredResources.map((res) => (
                  <motion.div 
                    layout
                    key={res.id}
                    className="glass rounded-3xl overflow-hidden group hover:border-white/20 transition-all"
                  >
                    <div className="relative aspect-video overflow-hidden">
                      <img src={res.thumbnail} alt={res.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-elite-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-full bg-white text-elite-black flex items-center justify-center">
                          <Play size={20} fill="currentColor" />
                        </div>
                      </div>
                      <div className="absolute bottom-4 right-4 px-2 py-1 bg-elite-black/80 backdrop-blur-sm rounded text-[10px] font-bold">
                        {res.duration}
                      </div>
                    </div>
                    <div className="p-8 space-y-6">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-gold mb-2 block">
                          {RESOURCE_CATEGORIES.find(c => c.id === res.category)?.name}
                        </span>
                        <h3 className="text-xl font-display">{res.title}</h3>
                      </div>
                      
                      <div className="space-y-3">
                        <p className="text-[10px] uppercase tracking-widest font-bold opacity-30">Learning Objectives</p>
                        <ul className="space-y-2">
                          {res.learningObjectives.map((obj, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs opacity-60">
                              <Circle size={4} className="mt-1.5 fill-gold text-gold" />
                              {obj}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button className="w-full py-4 bg-white/5 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                        Start Module <ChevronRight size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeView === 'studio' && (
            <AIStudioPage
              accessToken={accessToken}
              onRequireSignIn={() => setAuthScreen('login')}
              onSignOut={handleSignOut}
            />
          )}

          {activeView === 'docs' && <BlueprintDocsPage />}
          {activeView === 'admin' && memberRole === 'admin' && accessToken && <AdminWorkspace accessToken={accessToken} />}

          {activeView === 'profile' && (
            <Profile
              profile={agentProfile}
              milestones={milestones}
              roadmap={roadmap}
              challenges={challenges}
              onUpdateProfile={setAgentProfile}
              onToggleMilestone={handleToggleMilestone}
              onToggleChallenge={handleToggleChallenge}
              onNavigate={setActiveView}
              onSignOut={handleSignOut}
              onViewPublicLanding={() => {
                setAuthScreen('landing');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-white/5 bg-elite-black/50 backdrop-blur-sm py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="space-y-2 text-center md:text-left">
            <h4 className="font-display text-2xl">Join the Conversation</h4>
            <p className="text-sm opacity-40">Connect with 5,000+ elite agents in our private community.</p>
          </div>
          <div className="flex gap-4">
            <button className="px-8 py-3 bg-white text-elite-black rounded-full font-bold text-xs uppercase tracking-widest hover:bg-gold transition-colors">
              Community Portal
            </button>
            <button className="px-8 py-3 border border-white/10 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-white/5 transition-colors">
              Event Calendar
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/5 flex flex-wrap justify-between items-center gap-4 text-[10px] opacity-40 uppercase tracking-[0.2em]">
          <p>© 2026 Moonshine Capital. All Rights Reserved.</p>
          <div className="flex flex-wrap gap-6">
            <button type="button" onClick={() => openPublicScreen('landing')} className="hover:text-gold transition-colors uppercase">Public Landing</button>
            <button type="button" onClick={() => openPublicScreen('pricing')} className="hover:text-gold transition-colors uppercase">Pricing</button>
            <button type="button" onClick={() => openPublicScreen('login')} className="hover:text-gold transition-colors uppercase">OAuth Login</button>
            <button type="button" onClick={() => setActiveView('docs')} className="hover:text-gold transition-colors uppercase">Blueprint Docs</button>
            <button type="button" onClick={handleSignOut} className="hover:text-gold transition-colors uppercase">Sign Out</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
