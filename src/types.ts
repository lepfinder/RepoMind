export interface Project {
  name: string;
  owner: string;
  repo: string;
  description: string;
  remoteUrl: string;
  githubUrl: string;
  language: string;
  topics: string[];
  lastCommitHash: string;
  lastCommitMessage: string;
  lastCommitDate: string;
  path: string;
  scannedAt: string;
  createdAt: string;

  // GitHub stats & Version diffs
  stars: number;
  forks: number;
  remoteCommitHash: string;
  remoteCommitDate: string;
  compareStatus: string;
  aheadBy: number;
  behindBy: number;
}
