import { query } from "./db.js";

async function main() {
  console.log("--- MAINS TAXONOMY NODES ---");
  const nodesRes = await query("select * from assessment.mains_taxonomy_nodes limit 50;");
  console.table(nodesRes.map(r => ({ id: r.id, exam_id: r.exam_id, node_type: r.node_type, name: r.name, slug: r.slug, parent_id: r.parent_id })));

  console.log("\n--- MAINS TAXONOMY LINKS ---");
  const linksRes = await query("select * from assessment.mains_question_taxonomy_links limit 50;");
  console.table(linksRes);

  console.log("\n--- MAINS QUESTIONS count ---");
  const countRes = await query("select count(*) from assessment.questions where question_family = 'mains_subjective';");
  console.log("Total mains questions in questions table:", countRes[0]?.count);

  console.log("\n--- MAINS QUESTION DETAILS count ---");
  const detailsRes = await query("select count(*) from assessment.mains_question_details;");
  console.log("Total mains question details:", detailsRes[0]?.count);
}

main().catch(console.error);
