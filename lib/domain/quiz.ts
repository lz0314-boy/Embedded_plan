export type ObjectiveQuestion = {
  questionType?: "single-choice" | "multi-choice" | "true-false" | "short-answer";
  correctAnswer?: string | string[];
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[，。；、\s]+/g, "");
}

/** Objective questions require an exact normalized answer/key match. */
export function gradeObjectiveAnswer(question: ObjectiveQuestion, selected: string): boolean | null {
  if (!question.correctAnswer || question.questionType === "short-answer") return null;
  if (Array.isArray(question.correctAnswer)) {
    const expected = question.correctAnswer.map(normalize).sort();
    const actual = selected.split(/[,，;；\s]+/).map(normalize).filter(Boolean).sort();
    return expected.length === actual.length && expected.every((value, index) => value === actual[index]);
  }
  return normalize(selected) === normalize(question.correctAnswer);
}

export type RecallRating = "again" | "hard" | "good" | "easy";

export const recallRatings: readonly { id: RecallRating; label: string; description: string }[] = [
  { id: "again", label: "忘记", description: "完全不会或答错" },
  { id: "hard", label: "困难", description: "勉强想起" },
  { id: "good", label: "掌握", description: "正常答出" },
  { id: "easy", label: "简单", description: "无需思考即可答出" },
];
