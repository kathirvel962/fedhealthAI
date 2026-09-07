/**
 * Mock Chatbot Service for FedHealth AI Assistant (Day 2 UI Flow)
 * 
 * Provides simulated, role-specific health intelligence responses for the frontend interface.
 * All logic in this file is strictly isolated and will be replaced by the authenticated
 * Django API endpoint (POST /api/chat/) in Day 3.
 */

// Role-specific initial welcome messages
export const ROLE_WELCOME_MESSAGES = {
  SURVEILLANCE_OFFICER:
    "Hello! I'm your FedHealth AI Health Intelligence Assistant. I can help you understand outbreak alerts, surveillance trends, PHC risk levels, and epidemiological patterns.",
  DISTRICT_ADMIN:
    "Hello! I'm your FedHealth AI Health Intelligence Assistant. I can help you understand district health risks, PHC performance, federated learning insights, and surveillance trends."
};

// Role-specific suggested questions
export const ROLE_SUGGESTED_QUESTIONS = {
  SURVEILLANCE_OFFICER: [
    "Which PHCs currently have high outbreak risk?",
    "Explain the latest outbreak alerts.",
    "Which diseases are showing unusual increases?",
    "Which PHCs are showing signs of disease propagation?",
    "Summarize the current surveillance situation."
  ],
  DISTRICT_ADMIN: [
    "Which PHCs currently have the highest risk?",
    "Summarize the district health situation.",
    "Which diseases are increasing across the district?",
    "How are the PHCs performing?",
    "Explain the latest federated learning results."
  ]
};

// Demo response watermark disclaimer
const DEMO_DISCLAIMER = "\n\n> ℹ️ *This is a demo response for the chatbot interface. Real FedHealth AI health intelligence will be connected through the Django API in the next implementation stage.*";

/**
 * Canned mock intelligence responses keyed by keywords/intents
 */
const MOCK_KNOWLEDGE_BASE = {
  // Highest Risk / Outbreak Risk
  highest_risk: {
    SURVEILLANCE_OFFICER:
      "**PHC 5 (Valparai PHC)** currently exhibits the highest outbreak risk in the network with a composite risk score of **87.4/100 (CRITICAL)**.\n\n" +
      "**Key Risk Drivers:**\n" +
      "• **Fever Surge:** 62.5% of admitted patients presenting with high acute fever.\n" +
      "• **Abnormal WBC Ratio:** 48.0% of cohort displaying elevated leukocyte counts.\n" +
      "• **Active Incident:** Confirmed Dengue cluster (+171.0% increase over 76-day historical baseline).\n\n" +
      "**Recommended Action:** Dispatch targeted health advisories to neighboring facilities within 30 km (PHC 3 and PHC 4) and verify vector control measures.",
    DISTRICT_ADMIN:
      "Across the district, **PHC 5 (Valparai PHC)** has the highest composite risk at **87.4/100 [CRITICAL]**, followed by **PHC 2 (Sulur PHC)** at **64.2/100 [HIGH]**.\n\n" +
      "**District Risk Breakdown:**\n" +
      "• **Critical (1):** PHC 5 (Valparai)\n" +
      "• **High (1):** PHC 2 (Sulur)\n" +
      "• **Medium (2):** PHC 1 (Pollachi), PHC 4 (Thondamuthur)\n" +
      "• **Low (1):** PHC 3 (Kinathukadavu)\n\n" +
      "Overall District Health Index is **42.6/100 (Moderate Burden)**."
  },

  // Outbreak Alerts
  outbreak_alerts: {
    SURVEILLANCE_OFFICER:
      "There are currently **2 Active Surveillance Alerts** requiring your review:\n\n" +
      "1. **Dengue Outbreak Alert — PHC 5 (Valparai)**\n" +
      "   • **Severity:** [CRITICAL]\n" +
      "   • **Current Incidence:** 38 cases / 14 days vs Baseline: 14 cases\n" +
      "   • **Relative Increase:** **+171.0%** over historical threshold\n" +
      "   • **Status:** `NEW` (Pending Advisory Dispatch)\n\n" +
      "2. **Viral Fever Surge Alert — PHC 2 (Sulur)**\n" +
      "   • **Severity:** [HIGH]\n" +
      "   • **Current Incidence:** 54 cases / 14 days vs Baseline: 40 cases\n" +
      "   • **Relative Increase:** **+35.0%** over baseline\n" +
      "   • **Status:** `ACKNOWLEDGED`\n\n" +
      "You can review details and send advisory emails from the **Surveillance Officer View**.",
    DISTRICT_ADMIN:
      "Recent algorithmic surveillance flagged **2 active district alerts**:\n\n" +
      "• **PHC 5:** Dengue Outbreak (+171.0% vs baseline) — *Critical Severity*\n" +
      "• **PHC 2:** Viral Fever Elevation (+35.0% vs baseline) — *High Severity*\n\n" +
      "All 5 PHC nodes are reporting active telemetry. Surveillance officer notifications are in progress."
  },

  // Increasing Diseases
  increasing_diseases: {
    SURVEILLANCE_OFFICER:
      "Epidemiological evaluation over the past 14-day window reveals:\n\n" +
      "• **Dengue:** **+171.0% surge** (Hotspot: PHC 5 Valparai, 38 cases)\n" +
      "• **Viral Fever:** **+34.2% increase** (Concentrated in PHC 2 Sulur & PHC 1 Pollachi)\n" +
      "• **Typhoid:** Stable (+2.1% variance, within normal parameters)\n" +
      "• **Acute Gastroenteritis (AGE):** Negative trend (-8.4% below seasonal baseline)\n\n" +
      "Dengue transmission dynamics represent the primary vector requiring immediate surveillance focus.",
    DISTRICT_ADMIN:
      "Disease distribution across the Coimbatore district health network:\n\n" +
      "1. **Dengue:** Rapidly expanding in western highland sector (+171.0% delta)\n" +
      "2. **Viral Fever:** Moderate increase (+34.2% across 3 centers)\n" +
      "3. **Respiratory Infections:** Stable at baseline rates\n" +
      "4. **Other Infectious Diseases:** Low prevalence across all 5 participating nodes."
  },

  // Propagation / Proximity
  propagation: {
    SURVEILLANCE_OFFICER:
      "**Spatial Propagation Assessment for PHC 5 (Valparai):**\n\n" +
      "Based on GPS topological neighbor coordinates and the 30 km transmission radius:\n\n" +
      "• **PHC 3 (Kinathukadavu PHC):** **12.4 km away** — Secondary risk exposure; heightened diagnostic vigilance recommended.\n" +
      "• **PHC 4 (Thondamuthur PHC):** **18.1 km away** — Tertiary risk exposure; mosquito abatement advised.\n" +
      "• **PHC 1 & PHC 2:** Outside the immediate 30 km propagation corridor (>45 km).\n\n" +
      "You can dispatch cross-PHC early warning advisories directly to PHC 3 and PHC 4 from the Surveillance dashboard.",
    DISTRICT_ADMIN:
      "Topological distance matrix analysis shows strong geographic clustering between **PHC 5**, **PHC 3 (12.4 km)**, and **PHC 4 (18.1 km)**. Resource allocation and clinical supplies are recommended for this southeastern corridor."
  },

  // Summary / Triage
  summary: {
    SURVEILLANCE_OFFICER:
      "**Daily Surveillance Intelligence Briefing:**\n\n" +
      "• **Network Status:** 5/5 Primary Health Centers online and synchronizing telemetry.\n" +
      "• **Critical Alerts:** 1 Unacknowledged Critical Alert (PHC 5 Dengue).\n" +
      "• **High Priority Actions:** Review PHC 5 alert and dispatch geographic advisories to PHC 3 & PHC 4.\n" +
      "• **Risk Heatmap:** Valparai sector (Red/Critical), Sulur sector (Orange/High), remaining 3 sectors (Yellow/Green Stable).",
    DISTRICT_ADMIN:
      "**District Health Network Executive Summary:**\n\n" +
      "• **District Composite Health Index:** **42.6 / 100** (Moderate Risk)\n" +
      "• **Active Reporting Centers:** 5 PHCs reporting 1,420 total patient intake records.\n" +
      "• **Primary Outbreak Hotspot:** PHC 5 (Composite Score: 87.4).\n" +
      "• **Federated Model Health:** Global Model v3 converged at **92.4% validation accuracy**.\n" +
      "• **Model Drift Status:** All 5 local models are stable with drift metric < 6.8%."
  },

  // Federated Learning / Model Performance
  federated_learning: {
    DISTRICT_ADMIN:
      "**Federated Learning Intelligence Report:**\n\n" +
      "• **Current Global Model:** `global_v3` (Aggregated via FedAvg)\n" +
      "• **Global Validation Accuracy:** **92.4%** (+3.1% improvement over Round 2)\n" +
      "• **Participating Nodes:** 5 PHCs (PHC 1 through PHC 5)\n" +
      "• **Total Sample Size:** 1,280 distributed patient records\n" +
      "• **Non-IID Divergence:** Highest Jensen-Shannon Divergence (JSD) observed at PHC 5 ($\\\\mathrm{JSD} = 0.084$), attributed to local Dengue case cluster.\n" +
      "• **Drift Monitoring:** Zero catastrophic model drift detected across local weights.",
    SURVEILLANCE_OFFICER:
      "The FedHealth AI diagnostic model (`global_v3`) is currently running with **92.4% diagnostic accuracy** across all 5 centers, providing reliable symptom-to-disease anomaly detection."
  },

  // Privacy Protection
  privacy_refusal: {
    ALL:
      "🛡️ **Privacy Guardrail Activated**\n\n" +
      "The FedHealth AI Health Intelligence Assistant operates under strict privacy-by-design and federated principles. **Individual patient identification numbers, clinical names, and personal health records (PII) are strictly inaccessible.**\n\n" +
      "I can, however, provide aggregated epidemiology metrics, symptom percentages, disease distribution, or composite risk scores for any Primary Health Center."
  }
};

/**
 * Matches a user query against the mock knowledge base
 * @param {string} query - The user's input prompt
 * @param {string} role - 'SURVEILLANCE_OFFICER' | 'DISTRICT_ADMIN'
 * @returns {string} Formatted response string
 */
export const generateMockResponse = (query, role = 'DISTRICT_ADMIN') => {
  const normalized = query.toLowerCase().trim();

  // Test error trigger
  if (normalized === 'test error' || normalized === 'throw error' || normalized === '__trigger_error__') {
    throw new Error('Simulated network error for testing error state.');
  }

  // Privacy violation / PII check
  if (
    normalized.includes('patient id') ||
    normalized.includes('patient name') ||
    normalized.includes('medical history for patient') ||
    normalized.includes('p000') ||
    normalized.includes('p001') ||
    normalized.includes('password') ||
    normalized.includes('secret_key') ||
    normalized.includes('smtp')
  ) {
    return MOCK_KNOWLEDGE_BASE.privacy_refusal.ALL + DEMO_DISCLAIMER;
  }

  // Outbreak / Highest Risk
  if (
    normalized.includes('high') && normalized.includes('risk') ||
    normalized.includes('highest risk') ||
    normalized.includes('outbreak risk') ||
    normalized.includes('critical phc')
  ) {
    const resp = MOCK_KNOWLEDGE_BASE.highest_risk[role] || MOCK_KNOWLEDGE_BASE.highest_risk.DISTRICT_ADMIN;
    return resp + DEMO_DISCLAIMER;
  }

  // Outbreak Alerts
  if (
    normalized.includes('alert') ||
    normalized.includes('outbreak alerts') ||
    normalized.includes('attention right now')
  ) {
    const resp = MOCK_KNOWLEDGE_BASE.outbreak_alerts[role] || MOCK_KNOWLEDGE_BASE.outbreak_alerts.SURVEILLANCE_OFFICER;
    return resp + DEMO_DISCLAIMER;
  }

  // Increasing Diseases
  if (
    normalized.includes('disease') && (normalized.includes('increase') || normalized.includes('unusual') || normalized.includes('trend')) ||
    normalized.includes('increasing across')
  ) {
    const resp = MOCK_KNOWLEDGE_BASE.increasing_diseases[role] || MOCK_KNOWLEDGE_BASE.increasing_diseases.SURVEILLANCE_OFFICER;
    return resp + DEMO_DISCLAIMER;
  }

  // Propagation / Proximity
  if (
    normalized.includes('propagation') ||
    normalized.includes('proximity') ||
    normalized.includes('near phc 5') ||
    normalized.includes('neighbor') ||
    normalized.includes('transmission radius')
  ) {
    const resp = MOCK_KNOWLEDGE_BASE.propagation[role] || MOCK_KNOWLEDGE_BASE.propagation.SURVEILLANCE_OFFICER;
    return resp + DEMO_DISCLAIMER;
  }

  // Federated Learning / Model Performance
  if (
    normalized.includes('federated') ||
    normalized.includes('model') ||
    normalized.includes('round') ||
    normalized.includes('drift') ||
    normalized.includes('accuracy') ||
    normalized.includes('performing')
  ) {
    const resp = MOCK_KNOWLEDGE_BASE.federated_learning[role] || MOCK_KNOWLEDGE_BASE.federated_learning.DISTRICT_ADMIN;
    return resp + DEMO_DISCLAIMER;
  }

  // Summary / Surveillance situation
  if (
    normalized.includes('summarize') ||
    normalized.includes('summary') ||
    normalized.includes('situation') ||
    normalized.includes('overview') ||
    normalized.includes('review first today')
  ) {
    const resp = MOCK_KNOWLEDGE_BASE.summary[role] || MOCK_KNOWLEDGE_BASE.summary.DISTRICT_ADMIN;
    return resp + DEMO_DISCLAIMER;
  }

  // Generic fallback response tailored to role
  if (role === 'SURVEILLANCE_OFFICER') {
    return (
      `I analyzed your query: **"${query}"**.\n\n` +
      `**Surveillance Intelligence Status:**\n` +
      `• Active monitoring across 5 PHC nodes is operational.\n` +
      `• 1 Critical Alert is active at **PHC 5 (Valparai)** with Dengue incidence surge.\n` +
      `• Topological transmission vector points toward **PHC 3** (12.4 km) and **PHC 4** (18.1 km).\n\n` +
      `You can ask me to explain specific alerts, check disease baselines, or evaluate spatial neighbor propagation.` +
      DEMO_DISCLAIMER
    );
  } else {
    return (
      `I analyzed your query: **"${query}"**.\n\n` +
      `**District Intelligence Status:**\n` +
      `• District Health Composite Risk Score is currently **42.6/100 (Moderate)**.\n` +
      `• **PHC 5** is the highest risk node (87.4/100, Critical).\n` +
      `• Federated Global Model \`global_v3\` is healthy with **92.4% test accuracy**.\n\n` +
      `You can ask me to compare PHC risk profiles, summarize federated learning rounds, or review district outbreak trends.` +
      DEMO_DISCLAIMER
    );
  }
};

/**
 * Asynchronously sends a message through the mock chatbot pipeline with simulated latency
 * @param {Object} params - { message, role, conversationId }
 * @returns {Promise<Object>} Response object
 */
export const sendMockChatMessage = async ({ message, role = 'DISTRICT_ADMIN', conversationId = 'mock_conv_1' }) => {
  // Simulate realistic network inference delay between 600ms - 900ms
  const delayMs = Math.floor(Math.random() * 300) + 600;

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const text = generateMockResponse(message, role);
        resolve({
          success: true,
          conversation_id: conversationId,
          response: text,
          timestamp: new Date().toISOString(),
          metadata: {
            role,
            isMock: true
          }
        });
      } catch (err) {
        reject(err);
      }
    }, delayMs);
  });
};
