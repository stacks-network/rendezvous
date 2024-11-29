export type ClarinetToml = {
  project: {
    name: string;
    description: string;
    authors: string[];
    telemetry: boolean;
    cache_dir: string;
    requirements: any[];
  };
  contracts: {
    [key: string]: {
      path: string;
      epoch?: number | string;
      clarity_version: number;
    };
  };
};
