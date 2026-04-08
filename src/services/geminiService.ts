import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface JDSkills {
  mustHave: string[];
  goodToHave: string[];
  roleTitle: string;
  experience: string;
  location: string;
}

export interface ResumeData {
  name: string;
  email: string;
  skills: string[];
  experience: string;
  education: string[];
  summary: string;
  location: string;
}

export interface MatchResult {
  score: number;
  matchedMustHave: string[];
  matchedGoodToHave: string[];
  missingMustHave: string[];
  analysis: string;
}

export async function analyzeJD(jdText: string): Promise<JDSkills> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following Job Description and extract the role title, "Must-Have" skills (mandatory), "Good-to-Have" skills (preferred/optional), required experience (e.g. "5+ years"), and location requirements. 
    
    JD Text:
    ${jdText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          roleTitle: { type: Type.STRING },
          mustHave: { type: Type.ARRAY, items: { type: Type.STRING } },
          goodToHave: { type: Type.ARRAY, items: { type: Type.STRING } },
          experience: { type: Type.STRING, description: "Required years or level of experience" },
          location: { type: Type.STRING, description: "Job location or remote status" },
        },
        required: ["roleTitle", "mustHave", "goodToHave", "experience", "location"],
      },
    },
  });

  return JSON.parse(response.text);
}

export async function parseResume(resumeText: string): Promise<ResumeData> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract key information from this resume. 
    
    Resume Text:
    ${resumeText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          email: { type: Type.STRING },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          experience: { type: Type.STRING, description: "Brief summary of work history" },
          education: { type: Type.ARRAY, items: { type: Type.STRING } },
          summary: { type: Type.STRING, description: "One sentence professional summary" },
          location: { type: Type.STRING, description: "Candidate's current location" },
        },
        required: ["name", "email", "skills", "experience", "education", "summary", "location"],
      },
    },
  });

  return JSON.parse(response.text);
}

export async function scoreResumeAgainstJD(
  resumeText: string,
  jdSkills: JDSkills
): Promise<MatchResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Compare the following resume against the Job Description requirements using the EXACT weightage below.
    The total score MUST be out of 100.
    
    Weightage:
    1. Must-Have Skills: 50 points
    2. Good-to-Have Skills: 20 points
    3. Experience (Years/Level): 20 points
    4. Education: 5 points
    5. Location: 5 points
    
    JD Requirements:
    Role: ${jdSkills.roleTitle}
    Must-Have: ${jdSkills.mustHave.join(", ")}
    Good-to-Have: ${jdSkills.goodToHave.join(", ")}
    Required Experience: ${jdSkills.experience}
    Required Location: ${jdSkills.location}
    
    Resume Text:
    ${resumeText}
    
    Perform semantic matching (e.g., "Azure SaaS" vs "Azure PaaS" context).
    If a category is partially met, award partial points.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          matchedMustHave: { type: Type.ARRAY, items: { type: Type.STRING } },
          matchedGoodToHave: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingMustHave: { type: Type.ARRAY, items: { type: Type.STRING } },
          analysis: { type: Type.STRING, description: "Brief explanation of how the points were distributed based on the weightage" },
        },
        required: ["score", "matchedMustHave", "matchedGoodToHave", "missingMustHave", "analysis"],
      },
    },
  });

  return JSON.parse(response.text);
}
