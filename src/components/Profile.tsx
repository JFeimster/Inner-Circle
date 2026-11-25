import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { AgentProfile, Challenge, Milestone, RoadmapWeek } from '../types';

interface ProfileProps {
  profile: AgentProfile;
  milestones: Milestone[];
  roadmap: RoadmapWeek[];
  challenges: Challenge[];
  onUpdateProfile: (updated: AgentProfile) => void;
  onToggleMilestone: (milestoneId: string) => void;
  onToggleChallenge: (challengeId: string) => void;
  onNavigate: (view: 'dashboard' | 'roadmap' | 'resources' | 'studio' | 'docs' | 'profile' | 'admin') => void;
  onSignOut?: () => void;
  onViewPublicLanding?: () => void;
}

export default function Profile({
  profile,
  milestones,
  roadmap,
  challenges,
  onUpdateProfile,
  onToggleMilestone,
  onToggleChallenge,
  onNavigate,
  onSignOut,
  onViewPublicLanding,
}: ProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<AgentProfile>(profile);
  const [avatarError, setAvatarError] = useState(false);

  const totalRoadmapSteps = roadmap.reduce((acc, w) => acc + w.steps.length, 0);
  const completedRoadmapSteps = roadmap.reduce(
    (acc, w) => acc + w.steps.filter((s) => s.completed).length,
    0
  );

  const completedMilestones = milestones.filter((m) => m.completed).length;
  const earnedPoints = challenges
    .filter((c) => c.completed)
    .reduce((sum, c) => sum + c.points, 0);
  const totalPoints = challenges.reduce((sum, c) => sum + c.points, 0);
  const completedChallengesCount = challenges.filter((c) => c.completed).length;

  const totalTrackableItems =
    totalRoadmapSteps + milestones.length + challenges.length;
  const completedTrackableItems =
    completedRoadmapSteps + completedMilestones + completedChallengesCount;
  const overallProgress =
    totalTrackableItems > 0
      ? Math.round((completedTrackableItems / totalTrackableItems) * 100)
      : 0;

  const initials = profile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const handleOpenEdit = () => {
    setDraft(profile);
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedName = draft.name.trim() || profile.name;
    const cleanedRole = draft.role.trim() || profile.role;
    onUpdateProfile({
      ...draft,
      name: cleanedName,
      role: cleanedRole,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(profile);
    setIsEditing(false);
  };

  return (
    <motion.div
      key="profile"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.2 }}
      className="space-y-10"
    >
      {/* Profile Identity Header */}
      <section className="glass rounded-3xl p-8 md:p-10 border border-white/10">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {!avatarError ? (
              <img
                src={profile.avatar}
                alt={profile.name}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-24 h-24 rounded-full object-cover border border-gold/40 shrink-0"
              />
            ) : (
              <div className="w-24 h-24 rounded-full gold-gradient flex items-center justify-center text-elite-black font-display text-2xl font-bold shrink-0">
                {initials}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-gold tracking-wide">
                {profile.role}
              </p>
              <h1 className="text-3xl md:text-5xl font-display font-light text-white text-balance">
                {profile.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                <span>{profile.email}</span>
                <span aria-hidden="true">·</span>
                <span>{profile.territory}</span>
                <span aria-hidden="true">·</span>
                <span>{profile.cohort}</span>
                <span aria-hidden="true">·</span>
                <span>Mentor: {profile.mentorName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {!isEditing && (
              <button
                type="button"
                onClick={handleOpenEdit}
                className="px-5 py-2.5 rounded-full border border-white/15 hover:border-gold/50 hover:text-gold text-xs font-medium tracking-wide transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <Pencil size={14} />
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {!isEditing ? (
          <div className="mt-8 pt-6 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <p className="text-sm text-white/70 max-w-3xl leading-relaxed">
              {profile.bio}
            </p>
            <div className="w-full md:w-64 shrink-0 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Onboarding Readiness</span>
                <span className="font-semibold text-white tabular-nums">
                  {overallProgress}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-green rounded-full transition-all duration-300"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSave}
            className="mt-8 pt-6 border-t border-white/10 space-y-5"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="space-y-1.5 block">
                <span className="text-xs text-white/60">Full Name</span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white focus:outline-none focus:border-gold"
                  required
                />
              </label>
              <label className="space-y-1.5 block">
                <span className="text-xs text-white/60">Role</span>
                <input
                  type="text"
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white focus:outline-none focus:border-gold"
                  required
                />
              </label>
              <label className="space-y-1.5 block">
                <span className="text-xs text-white/60">Territory</span>
                <input
                  type="text"
                  value={draft.territory}
                  onChange={(e) =>
                    setDraft({ ...draft, territory: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white focus:outline-none focus:border-gold"
                />
              </label>
            </div>
            <label className="space-y-1.5 block">
              <span className="text-xs text-white/60">Agent Bio</span>
              <textarea
                rows={2}
                value={draft.bio}
                onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white focus:outline-none focus:border-gold resize-none"
              />
            </label>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 rounded-full border border-white/15 text-xs font-medium text-white/70 hover:text-white hover:border-white/30 transition-colors flex items-center gap-1.5"
              >
                <X size={14} />
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full gold-gradient text-elite-black text-xs font-semibold flex items-center gap-1.5 hover:opacity-95 transition-opacity"
              >
                <Check size={14} />
                Save Changes
              </button>
            </div>
          </form>
        )}
      </section>

      {/* 4-Column Progress Statistics Strip */}
      <section className="glass rounded-3xl border border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
        <div className="p-6 md:p-7 space-y-2">
          <p className="text-xs text-white/55">Overall Completion</p>
          <p className="text-3xl font-display text-white tabular-nums">
            {overallProgress}%
          </p>
          <p className="text-xs text-white/50 tabular-nums">
            {completedTrackableItems} of {totalTrackableItems} total items complete
          </p>
        </div>

        <div className="p-6 md:p-7 space-y-2">
          <p className="text-xs text-white/55">30-Day Roadmap</p>
          <p className="text-3xl font-display text-white tabular-nums">
            {completedRoadmapSteps}
            <span className="text-lg text-white/40"> / {totalRoadmapSteps}</span>
          </p>
          <p className="text-xs text-white/50">Action steps verified</p>
        </div>

        <div className="p-6 md:p-7 space-y-2">
          <p className="text-xs text-white/55">Core Milestones</p>
          <p className="text-3xl font-display text-gold tabular-nums">
            {completedMilestones}
            <span className="text-lg text-white/40"> / {milestones.length}</span>
          </p>
          <p className="text-xs text-white/50">Lead to commission track</p>
        </div>

        <div className="p-6 md:p-7 space-y-2">
          <p className="text-xs text-white/55">Quick-Win Points</p>
          <p className="text-3xl font-display text-white tabular-nums">
            {earnedPoints}
            <span className="text-lg text-white/40"> / {totalPoints} pts</span>
          </p>
          <p className="text-xs text-white/50 tabular-nums">
            {completedChallengesCount} of {challenges.length} challenges claimed
          </p>
        </div>
      </section>

      {/* Detailed Progress Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left: Weekly 30-Day Roadmap Progress */}
        <section className="lg:col-span-7 glass rounded-3xl p-8 border border-white/10 flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-display text-white">
                  30-Day Roadmap Progress
                </h2>
                <p className="text-xs text-white/55 mt-1">
                  Weekly completion across foundation, mastery, outreach, and conversion.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('roadmap')}
                className="text-xs font-medium text-gold hover:underline flex items-center gap-1.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded"
              >
                Open Roadmap <ArrowRight size={14} />
              </button>
            </div>

            <div className="divide-y divide-white/10">
              {roadmap.map((week) => {
                const doneCount = week.steps.filter((s) => s.completed).length;
                const totalCount = week.steps.length;
                const pct =
                  totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

                return (
                  <div key={week.week} className="py-5 first:pt-2 last:pb-2 space-y-3">
                    <div className="flex items-baseline justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-white">
                          Week {week.week} · {week.theme}
                        </p>
                        <p className="text-xs text-white/50 mt-0.5">
                          {week.objective}
                        </p>
                      </div>
                      <div className="text-right shrink-0 tabular-nums">
                        <p className="text-sm font-semibold text-white">
                          {doneCount}/{totalCount}
                        </p>
                        <p className="text-xs text-white/45">{pct}%</p>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-green rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right: Milestones & Quick Wins */}
        <section className="lg:col-span-5 glass rounded-3xl p-8 border border-white/10 flex flex-col justify-between space-y-8">
          <div className="space-y-8">
            {/* Milestones */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-display text-white">
                  Core Milestones
                </h2>
                <span className="text-xs text-white/50 tabular-nums">
                  {completedMilestones} of {milestones.length} achieved
                </span>
              </div>

              <div className="divide-y divide-white/10">
                {milestones.map((milestone) => (
                  <button
                    key={milestone.id}
                    type="button"
                    onClick={() => onToggleMilestone(milestone.id)}
                    className="w-full py-4 first:pt-1 last:pb-1 flex items-start justify-between gap-4 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-lg"
                  >
                    <div className="flex items-start gap-3">
                      {milestone.completed ? (
                        <CheckCircle2
                          size={18}
                          className="text-green mt-0.5 shrink-0"
                        />
                      ) : (
                        <Circle
                          size={18}
                          className="text-white/30 group-hover:text-gold mt-0.5 shrink-0 transition-colors"
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium text-white">
                          {milestone.title}
                        </p>
                        <p className="text-xs text-white/50 mt-0.5">
                          {milestone.description}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium shrink-0 ${
                        milestone.completed ? 'text-green' : 'text-white/45'
                      }`}
                    >
                      {milestone.completed ? 'Completed' : 'In Progress'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick-Win Challenges */}
            <div className="pt-6 border-t border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-display text-white">
                  Quick-Win Challenges
                </h3>
                <span className="text-xs text-gold tabular-nums">
                  {earnedPoints} pts earned
                </span>
              </div>

              <div className="divide-y divide-white/10">
                {challenges.map((challenge) => (
                  <button
                    key={challenge.id}
                    type="button"
                    onClick={() => onToggleChallenge(challenge.id)}
                    className="w-full py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-4 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {challenge.completed ? (
                        <CheckCircle2
                          size={16}
                          className="text-green shrink-0"
                        />
                      ) : (
                        <Circle
                          size={16}
                          className="text-white/30 group-hover:text-gold shrink-0 transition-colors"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">
                          {challenge.title}
                        </p>
                        <p className="text-xs text-white/50">
                          {challenge.reward}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium tabular-nums shrink-0 ${
                        challenge.completed ? 'text-green' : 'text-gold'
                      }`}
                    >
                      {challenge.completed
                        ? `Claimed (+${challenge.points})`
                        : `+${challenge.points} pts`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate('resources')}
                className="text-xs font-medium text-white/70 hover:text-gold transition-colors flex items-center gap-1.5"
              >
                Visit Resource Center <ArrowRight size={14} />
              </button>
              {onViewPublicLanding && (
                <button
                  type="button"
                  onClick={onViewPublicLanding}
                  className="text-xs font-medium text-white/55 hover:text-white transition-colors"
                >
                  View Public Landing
                </button>
              )}
            </div>
            {onSignOut ? (
              <button
                type="button"
                onClick={onSignOut}
                className="text-xs font-medium text-gold hover:underline transition-colors"
              >
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="text-xs font-medium text-white/70 hover:text-gold transition-colors"
              >
                Back to Dashboard
              </button>
            )}
          </div>
        </section>
      </div>
    </motion.div>
  );
}
