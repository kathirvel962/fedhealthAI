import emailjs from '@emailjs/browser';

// Retrieve environment variables
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

/**
 * Send a Primary Health Center Surveillance alert using EmailJS
 * 
 * @param {Object} params - Template parameter mapping
 * @returns {Promise} EmailJS response promise
 */
export const sendPHCAlert = async (params) => {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.error('EmailJS credentials are not configured in environment variables.');
    throw new Error('EmailJS credentials are not configured.');
  }

  // 1. Normalize recipient email string
  const recipientEmail = String(params.to_email || "").trim();

  // 2. Validate recipient email
  if (!recipientEmail) {
    throw new Error("PHC recipient email is missing");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(recipientEmail)) {
    throw new Error("PHC email address is invalid.");
  }

  // 3. Compile template parameters preserving source and target distinction
  const templateParams = {
    to_email: recipientEmail,
    phc_id: params.phc_id,                // Recipient neighboring PHC ID
    phc_name: params.phc_name,            // Recipient neighboring PHC Name
    source_phc_id: params.source_phc_id,    // Source outbreak PHC ID
    source_phc_name: params.source_phc_name,// Source outbreak PHC Name
    severity: params.severity,
    risk_score: params.risk_score,
    disease: params.disease,
    alert_message: params.alert_message,
    alert_time: params.alert_time,
  };

  // 4. Add development logging before send
  console.log("[PHC NOTIFICATION]");
  console.log("Source PHC:", params.source_phc_id);
  console.log("Target PHC:", params.phc_id);
  console.log("Target PHC Name:", params.phc_name);
  console.log("Target Email:", recipientEmail);
  console.log("Severity:", params.severity);
  console.log("Risk Score:", params.risk_score);
  
  console.log("[EMAILJS]");
  console.log("Template ID:", TEMPLATE_ID);
  console.log("Sending notification to:", recipientEmail);
  
  // 5. Verify the actual final value sent to EmailJS
  console.log("Verified templateParams.to_email equals:", templateParams.to_email);

  try {
    const response = await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      templateParams,
      PUBLIC_KEY
    );
    
    // 6. Logging after successful send
    console.log("[EMAILJS]");
    console.log("Notification sent successfully");
    console.log("Recipient:", recipientEmail);
    
    return response;
  } catch (error) {
    // 7. Logging after failure
    console.log("[EMAILJS]");
    console.log("Notification failed");
    console.log("Recipient:", recipientEmail);
    console.log("Error:", error);
    
    throw error;
  }
};
