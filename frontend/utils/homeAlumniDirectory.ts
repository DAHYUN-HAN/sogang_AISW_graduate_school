type DirectoryBoard = {
  slug: string;
  is_active?: boolean;
  metadata?: Record<string, unknown> | null;
};

export const HOME_ALUMNI_DIRECTORY_URL = "https://app.rmbr.in/SPbmZjUxRzb";

export type HomeAlumniDirectoryLink =
  | { status: "ready"; url: string }
  | { status: "missing" }
  | { status: "invalid" };

export function homeAlumniDirectoryLink(_boards: DirectoryBoard[]): HomeAlumniDirectoryLink {
  return { status: "ready", url: HOME_ALUMNI_DIRECTORY_URL };
}
