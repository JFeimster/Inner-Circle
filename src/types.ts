export interface Milestone {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  icon: string;
}

export interface Resource {
  id: string;
  title: string;
  category: string;
  thumbnail: string;
  duration: string;
  learningObjectives: string[];
}

export interface ResourceCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface RoadmapStep {
  id: string;
  title: string;
  isAction: boolean;
  completed: boolean;
}

export interface RoadmapWeek {
  week: number;
  theme: string;
  objective: string;
  steps: RoadmapStep[];
}

export interface SuccessStory {
  id: string;
  agentName: string;
  achievement: string;
  avatar: string;
  timestamp: string;
}

export interface Challenge {
  id: string;
  title: string;
  reward: string;
  points: number;
  completed: boolean;
}

export interface AgentProfile {
  name: string;
  role: string;
  email: string;
  territory: string;
  cohort: string;
  mentorName: string;
  bio: string;
  avatar: string;
}
