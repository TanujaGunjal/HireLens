from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from functools import lru_cache
import numpy as np
import re

app = FastAPI(title="Semantic Matching AI Engine v2")

# ─────────────────────────────────────────────────────────────────────────────
# Model
# ─────────────────────────────────────────────────────────────────────────────
print("Loading sentence-transformers model...")
model = SentenceTransformer('all-MiniLM-L6-v2')
print("Model loaded successfully!")

# ─────────────────────────────────────────────────────────────────────────────
# Domain concept clusters
# Each cluster contains semantically related tech/concept terms.
# If the resume signals ≥ MIN_CLUSTER_HITS terms from a cluster AND the JD
# also overlaps that cluster, we award an extra concept-similarity boost
# so that deep backend knowledge is rewarded even without exact JD word matches.
# ─────────────────────────────────────────────────────────────────────────────
CONCEPT_CLUSTERS = {
    "messaging_systems": [
        "kafka", "rabbitmq", "activemq", "redis pubsub", "message queue",
        "event streaming", "pub/sub", "event-driven", "nats", "kinesis",
        "message broker", "asynchronous", "event bus"
    ],
    "distributed_systems": [
        "distributed", "microservices", "service mesh", "consensus",
        "raft", "paxos", "sharding", "replication", "horizontal scaling",
        "load balancing", "fault tolerance", "cap theorem", "eventual consistency",
        "leader election", "zookeeper", "etcd"
    ],
    "caching_layer": [
        "redis", "memcached", "caching", "cache", "in-memory",
        "ttl", "eviction", "cache invalidation", "cdn", "varnish"
    ],
    "backend_engineering": [
        "rest api", "restful", "graphql", "grpc", "websockets",
        "express", "fastapi", "django", "spring boot", "node.js",
        "api design", "microservice", "serverless", "lambda", "http"
    ],
    "databases": [
        "postgresql", "mysql", "mongodb", "cassandra", "dynamodb",
        "elasticsearch", "neo4j", "sqlite", "orm", "sql",
        "nosql", "indexing", "query optimization", "stored procedures",
        "transactions", "acid", "database design", "schema"
    ],
    "devops_cloud": [
        "docker", "kubernetes", "k8s", "ci/cd", "github actions",
        "jenkins", "terraform", "ansible", "aws", "gcp", "azure",
        "helm", "prometheus", "grafana", "observability", "monitoring",
        "ecs", "eks", "cloud formation", "infrastructure as code"
    ],
    "security": [
        "jwt", "oauth", "oauth2", "authentication", "authorization",
        "ssl", "tls", "https", "encryption", "rbac", "acl",
        "api key", "zero trust", "security audit", "penetration"
    ],
    "data_engineering": [
        "spark", "hadoop", "airflow", "etl", "data pipeline",
        "data warehouse", "bigquery", "snowflake", "dbt", "flink",
        "batch processing", "stream processing", "pandas", "numpy"
    ],
    "system_design": [
        "system design", "high availability", "scalability", "throughput",
        "latency", "performance", "bottleneck", "rate limiting",
        "circuit breaker", "retry logic", "idempotent", "saga pattern"
    ],
    "frontend": [
        "react", "angular", "vue", "nextjs", "typescript", "javascript",
        "css", "html", "redux", "zustand", "tailwind", "webpack",
        "vite", "jest", "cypress", "responsive design"
    ],
}

MIN_CLUSTER_HITS = 2          # minimum terms a text must contain from a cluster
CONCEPT_BOOST_PER_CLUSTER = 8  # score points added per matching cluster (0-100 scale)
MAX_CONCEPT_BOOST = 30         # cap on total concept boost


def _lower_tokens(text: str) -> set:
    """Return a set of lowercase words + bigrams from text."""
    text = text.lower()
    words = re.findall(r"[\w']+", text)
    bigrams = {f"{words[i]} {words[i+1]}" for i in range(len(words) - 1)}
    return set(words) | bigrams


def _cluster_hits(tokens: set, cluster_terms: list) -> int:
    """Count how many cluster terms appear in the token set."""
    count = 0
    for term in cluster_terms:
        # term may be a phrase (bigram) or single word
        if term in tokens:
            count += 1
    return count


def compute_concept_boost(resume_tokens: set, jd_tokens: set) -> float:
    """
    Award bonus score points when both resume and JD share domain cluster signals.
    This ensures Kafka/Redis/distributed-systems expertise is rewarded even when
    the JD uses different phrasing.
    """
    total_boost = 0.0
    for cluster_name, cluster_terms in CONCEPT_CLUSTERS.items():
        resume_hits = _cluster_hits(resume_tokens, cluster_terms)
        jd_hits     = _cluster_hits(jd_tokens,    cluster_terms)
        # Both resume and JD need to signal this cluster
        if resume_hits >= MIN_CLUSTER_HITS and jd_hits >= 1:
            # Scale boost by how many terms the resume hit (more depth = higher boost)
            depth_factor = min(resume_hits / len(cluster_terms), 1.0)
            total_boost += CONCEPT_BOOST_PER_CLUSTER * (0.5 + 0.5 * depth_factor)
    return min(total_boost, MAX_CONCEPT_BOOST)


# ─────────────────────────────────────────────────────────────────────────────
# Embedding helpers
# ─────────────────────────────────────────────────────────────────────────────
@lru_cache(maxsize=2048)
def get_embedding(text: str):
    if not text or not text.strip():
        text = "missing data"
    return tuple(model.encode(text).tolist())


def cos_sim(text1: str, text2: str) -> float:
    e1 = np.array(get_embedding(text1)).reshape(1, -1)
    e2 = np.array(get_embedding(text2)).reshape(1, -1)
    return float(cosine_similarity(e1, e2)[0][0])


# ─────────────────────────────────────────────────────────────────────────────
# Request models
# ─────────────────────────────────────────────────────────────────────────────
class SemanticScoreRequest(BaseModel):
    summary: str = ""
    skills: str = ""
    experience: str = ""
    projects: str = ""
    jdText: str = ""


class SkillMatchRequest(BaseModel):
    resumeSkills: list[str]
    jdKeywords: list[str]


# ─────────────────────────────────────────────────────────────────────────────
# /semantic-score  (enhanced)
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/semantic-score")
async def get_semantic_score(req: SemanticScoreRequest):
    try:
        jd = req.jdText.strip() or "software engineering role"

        # ── Section-level embedding similarities ──────────────────────────
        summary_sim    = max(0.0, cos_sim(req.summary    or "no summary",    jd))
        skills_sim     = max(0.0, cos_sim(req.skills     or "no skills",     jd))
        experience_sim = max(0.0, cos_sim(req.experience or "no experience", jd))
        projects_sim   = max(0.0, cos_sim(req.projects   or "no projects",   jd))

        # Convert to 0-100
        summary_score    = summary_sim    * 100
        skills_score     = skills_sim     * 100
        experience_score = experience_sim * 100
        projects_score   = projects_sim   * 100

        # ── Weighted embedding score ───────────────────────────────────────
        # Skills (35%) + Experience (30%) + Projects (25%) + Summary (10%)
        embedding_score = (
            skills_score     * 0.35 +
            experience_score * 0.30 +
            projects_score   * 0.25 +
            summary_score    * 0.10
        )

        # ── Concept-cluster boost ─────────────────────────────────────────
        # Combine all resume sections into one token set for cluster matching
        resume_all = f"{req.summary} {req.skills} {req.experience} {req.projects}"
        resume_tokens = _lower_tokens(resume_all)
        jd_tokens     = _lower_tokens(jd)

        concept_boost = compute_concept_boost(resume_tokens, jd_tokens)

        # ── Final semantic score ──────────────────────────────────────────
        # Clamp to [0, 100] after adding boost
        final_score = min(100.0, embedding_score + concept_boost)

        print(
            f"[SemanticEngine] embedding={embedding_score:.1f}  "
            f"concept_boost={concept_boost:.1f}  final={final_score:.1f}"
        )

        return {
            "semanticScore": round(final_score, 2),
            "embeddingScore": round(embedding_score, 2),
            "conceptBoost": round(concept_boost, 2),
            "sectionScores": {
                "skills":     round(skills_score,     2),
                "experience": round(experience_score, 2),
                "projects":   round(projects_score,   2),
                "summary":    round(summary_score,    2),
            }
        }
    except Exception as e:
        print(f"Semantic scoring error: {e}")
        return {"semanticScore": 0.0, "embeddingScore": 0.0, "conceptBoost": 0.0}


# ─────────────────────────────────────────────────────────────────────────────
# /skill-match  (unchanged logic, improved threshold comment)
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/skill-match")
async def get_skill_match(req: SkillMatchRequest):
    matches = []
    try:
        if not req.resumeSkills or not req.jdKeywords:
            return {"semanticMatches": []}

        resume_embs = [
            np.array(get_embedding(s)).reshape(1, -1)
            for s in req.resumeSkills
        ]

        for jd_skill in req.jdKeywords:
            jd_emb = np.array(get_embedding(jd_skill)).reshape(1, -1)
            best_match = None
            best_score = 0.0

            for index, res_emb in enumerate(resume_embs):
                sim = float(cosine_similarity(jd_emb, res_emb)[0][0])
                if sim > best_score:
                    best_score = sim
                    best_match = req.resumeSkills[index]

            # Lowered threshold from 0.70 → 0.65 for broader synonym matching
            if best_score > 0.65:
                matches.append({
                    "jdSkill": jd_skill,
                    "matchedWith": best_match,
                    "confidence": round(best_score, 2)
                })

        return {"semanticMatches": matches}
    except Exception as e:
        print(f"Skill match error: {e}")
        return {"semanticMatches": []}


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "2.0"}
