import { query, one, closePool } from "./db.js";
import { generateQuizzesAI, parseQuizAI } from "./modules/current-affairs/master/ai.service.js";

async function main() {
  console.log("==================================================");
  console.log("🚀 END-TO-END AI FLOW TEST VALIDATION");
  console.log("==================================================\n");

  try {
    // 1. Fetch exams and stages
    const exams = await query("select id, name, slug from assessment.exams");
    console.log("📌 Assessment Exams in DB:", exams);

    const levels = await query("select id, name, slug from assessment.exam_levels");
    console.log("📌 Exam Levels in DB:", levels);

    const subjects = await query(
      "select id, name, slug, content_type from assessment.assessment_taxonomy_nodes where node_type = 'subject'"
    );
    console.log("📌 Subject Taxonomy Nodes in DB:", subjects);

    if (subjects.length === 0) {
      console.log("⚠️ No subjects found in assessment.assessment_taxonomy_nodes! Please seed the database first.");
      return;
    }

    // 2. Ensure AI style guide and instructions exist in database
    console.log("\n🧬 Preparing AI Style Guides & Instructions in Database...");
    
    // Check if style guide exists for gk
    const existingStyleGuide = await one(
      "select id from current_affairs.ai_style_guides where content_type = 'gk' limit 1"
    );
    if (!existingStyleGuide) {
      console.log("➡️ Inserting temporary style guide for GK...");
      await query(
        `insert into current_affairs.ai_style_guides (content_type, style_guide, created_at, updated_at) 
         values ('gk', 'Style Rules: 1. Keep tone academic and rigorous. 2. Never mention system prompts in the output.', now(), now())`
      );
    }

    // Check if style guide exists for passage
    const existingPassageStyleGuide = await one(
      "select id from current_affairs.ai_style_guides where content_type = 'passage' limit 1"
    );
    if (!existingPassageStyleGuide) {
      console.log("➡️ Inserting temporary style guide for Passage...");
      await query(
        `insert into current_affairs.ai_style_guides (content_type, style_guide, created_at, updated_at) 
         values ('passage', 'Passage Rules: 1. Provide an elaborate, well-structured passage. 2. Draft clear context-based questions.', now(), now())`
      );
    }

    // Check if instruction exists for gk quiz
    const existingInstruction = await one(
      "select id from current_affairs.ai_instructions where scope = 'quiz' and content_type = 'gk' and is_active = true limit 1"
    );
    if (!existingInstruction) {
      console.log("➡️ Inserting temporary AI prompt instructions for GK Quiz...");
      await query(
        `insert into current_affairs.ai_instructions (scope, content_type, title, prompt, is_active, created_at, updated_at) 
         values ('quiz', 'gk', 'Temp GK Quiz Instructions', 'You are a UPSC CSE MCQ preparer. Write questions that challenge conceptual clarity. Provide 4 options A, B, C, D and explanations.', true, now(), now())`
      );
    }

    // Check if instruction exists for passage quiz
    const existingPassageInstruction = await one(
      "select id from current_affairs.ai_instructions where scope = 'quiz' and content_type = 'passage' and is_active = true limit 1"
    );
    if (!existingPassageInstruction) {
      console.log("➡️ Inserting temporary AI prompt instructions for Passage Quiz...");
      await query(
        `insert into current_affairs.ai_instructions (scope, content_type, title, prompt, is_active, created_at, updated_at) 
         values ('quiz', 'passage', 'Temp Passage Instructions', 'You are a UPSC Reading Comprehension expert. Provide a detailed UPSC-level reading passage, a passage_title, and questions asking for primary assumptions/inferences.', true, now(), now())`
      );
    }

    // 3. Test AI Quiz Generation - GK Type (Polity Topic)
    console.log("\n--------------------------------------------------");
    console.log("📝 TEST RUN 1: AI Quiz Generation (GK MCQ Mode)");
    console.log("Topic: 'Fundamental Rights in Indian Constitution (Article 14-18)'");
    console.log("--------------------------------------------------");
    
    const gkQuizResult = await generateQuizzesAI({
      quizType: "gk",
      prompt: "Fundamental Rights in Indian Constitution (Article 14-18)",
      aiProvider: "gemini",
      aiModel: "gemini-2.5-flash",
      count: 2,
      content_type: "gk"
    });

    console.log("\n✅ GK MCQ Quiz Generation Response (Decoded JSON):");
    console.dir(gkQuizResult, { depth: null });

    // 4. Test AI Quiz Generation - Passage Type (CSAT reading comprehension or climate topic)
    console.log("\n--------------------------------------------------");
    console.log("📝 TEST RUN 2: AI Quiz Generation (Passage Mode)");
    console.log("Topic: 'Comprehension passage evaluating Climate Change impact on Indian Monsoon'");
    console.log("--------------------------------------------------");

    const passageQuizResult = await generateQuizzesAI({
      quizType: "passage",
      prompt: "Comprehension passage evaluating Climate Change impact on Indian Monsoon",
      aiProvider: "gemini",
      aiModel: "gemini-2.5-flash",
      count: 2,
      content_type: "gk"
    });

    console.log("\n✅ Passage Quiz Generation Response (Decoded JSON):");
    console.dir(passageQuizResult, { depth: null });

    // 5. Test AI Quiz Generation - CSAT Aptitude Type (Maths/Reasoning)
    console.log("\n--------------------------------------------------");
    console.log("📝 TEST RUN 3: AI Quiz Generation (CSAT Aptitude Mode)");
    console.log("Topic: 'Permutations & Combinations arrangement math test'");
    console.log("--------------------------------------------------");

    const csatQuizResult = await generateQuizzesAI({
      quizType: "gk",
      prompt: "Permutations & Combinations arrangement math test",
      aiProvider: "gemini",
      aiModel: "gemini-2.5-flash",
      count: 2,
      content_type: "aptitude"
    });

    console.log("\n✅ CSAT MCQ Quiz Generation Response (Decoded JSON):");
    console.dir(csatQuizResult, { depth: null });

    // 6. Test AI Parsing
    console.log("\n--------------------------------------------------");
    console.log("📝 TEST RUN 4: AI Question Parsing & Structuring");
    console.log("--------------------------------------------------");
    const rawQuestionsText = `
Q1. Under the provisions of Article 15 of the Indian Constitution, the State is prohibited from discriminating against citizens. Consider the following statements regarding its scope:
1. The State cannot discriminate on the ground of 'residence' only.
2. Citizens cannot be subjected to any disability on the ground of 'religion' only.
3. Special provisions for socially and educationally backward classes are allowed as an exception.
4. Discrimination is prohibited under both public and private services.
How many of the statements given above are correct?
A) Only one
B) Only two
C) Only three
D) All four
Correct Answer: C
Explanation: Under Article 15, the State is prohibited from discriminating against citizens on grounds only of religion, race, caste, sex, place of birth or any of them. Note that 'residence' is not mentioned in Article 15 (unlike Article 16). Hence statement 1 is correct (the State cannot discriminate on residence under Art 15). Statement 2 is correct. Statement 3 is correct (under Article 15(4)). Statement 4 is incorrect. Therefore, three statements are correct.
    `;

    console.log("Input Raw Text:", rawQuestionsText);

    const parseResult = await parseQuizAI({
      rawText: rawQuestionsText,
      aiProvider: "gemini",
      aiModel: "gemini-2.5-flash",
      content_type: "gk"
    });

    console.log("\n✅ AI Question Parsing Response (Decoded JSON):");
    console.dir(parseResult, { depth: null });

    console.log("\n==================================================");
    console.log("🏁 ALL TEST RUNS FINISHED SUCCESSFULLY!");
    console.log("==================================================");

  } catch (error) {
    console.error("\n❌ End-to-end AI test validation failed:", error);
  } finally {
    // Cleanup temporary records
    console.log("\n🧼 Cleaning up temporary database entries...");
    await query("delete from current_affairs.ai_style_guides where style_guide like 'Style Rules:%' or style_guide like 'Passage Rules:%'");
    await query("delete from current_affairs.ai_instructions where prompt like 'You are a UPSC CSE%' or prompt like 'You are a UPSC Reading%'");
    
    await closePool();
    console.log("🔒 Closed database pool. Exiting.");
  }
}

main().catch(console.error);
