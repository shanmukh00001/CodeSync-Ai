const nodemailer = require("nodemailer");

/**
 * Creates and configures Nodemailer transporter.
 * Supports environment credentials or falls back to test/logger mode.
 */
let transporter = null;

function getTransporter() {
    const user = (process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
    const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || "").replace(/\s+/g, "");

    if (user && pass) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || "smtp.gmail.com",
            port: parseInt(process.env.SMTP_PORT || "587", 10),
            secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587
            auth: {
                user,
                pass,
            },
        });
    } else {
        // Dev fallback transporter (logs preview)
        transporter = {
            sendMail: async (mailOptions) => {
                console.log("================ [EMAIL DISPATCH - DEV SIMULATOR] ================");
                console.log(`To: ${mailOptions.to}`);
                console.log(`Subject: ${mailOptions.subject}`);
                console.log(`Content (Text): ${mailOptions.text || mailOptions.html}`);
                console.log("==================================================================");
                return { messageId: "dev-simulated-msg-" + Date.now() };
            }
        };
    }
    return transporter;
}

/**
 * Generates dark/orange themed branded email template
 */
function getEmailTemplate(otp, purposeTitle, description) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {
                background-color: #0b0f19;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                color: #e2e8f0;
                margin: 0;
                padding: 40px 20px;
            }
            .container {
                max-width: 540px;
                margin: 0 auto;
                background-color: #111827;
                border: 1px solid #1f293d;
                border-radius: 16px;
                padding: 36px 32px;
                box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.5);
            }
            .logo {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                font-size: 20px;
                font-weight: 800;
                color: #f97316;
                letter-spacing: -0.5px;
                margin-bottom: 24px;
            }
            .title {
                font-size: 22px;
                font-weight: 700;
                color: #f8fafc;
                margin-top: 0;
                margin-bottom: 12px;
            }
            .desc {
                font-size: 14px;
                line-height: 1.6;
                color: #94a3b8;
                margin-bottom: 28px;
            }
            .otp-box {
                background: linear-gradient(135deg, rgba(249, 115, 22, 0.12), rgba(234, 88, 12, 0.05));
                border: 1px solid rgba(249, 115, 22, 0.35);
                border-radius: 12px;
                padding: 20px;
                text-align: center;
                margin-bottom: 28px;
            }
            .otp-code {
                font-family: 'JetBrains Mono', 'Fira Code', monospace;
                font-size: 34px;
                font-weight: 800;
                letter-spacing: 10px;
                color: #fb923c;
                margin: 0;
            }
            .footer {
                font-size: 12px;
                color: #64748b;
                border-top: 1px solid #1e293b;
                padding-top: 20px;
                margin-top: 20px;
                line-height: 1.5;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">
                <span>⚡ CodeSync AI</span>
            </div>
            <h1 class="title">${purposeTitle}</h1>
            <p class="desc">${description}</p>
            <div class="otp-box">
                <div class="otp-code">${otp}</div>
            </div>
            <p class="desc" style="font-size: 13px; margin-bottom: 0;">
                This one-time code is valid for <strong>10 minutes</strong>. If you did not request this verification, you can safely ignore this email.
            </p>
            <div class="footer">
                &copy; ${new Date().getFullYear()} CodeSync AI. Real-time collaborative coding and intelligence platform.
            </div>
        </div>
    </body>
    </html>
    `;
}

/**
 * Send OTP Email
 */
async function sendOtpEmail(email, otp, purpose = "verification") {
    let title = "Verify Your Email Address";
    let desc = "Welcome to CodeSync AI! Please use the 6-digit verification code below to complete your authentication:";

    if (purpose === "login") {
        title = "Your Magic Login Code";
        desc = "Here is your 6-digit one-time login pass for CodeSync AI:";
    } else if (purpose === "reset_password") {
        title = "Password Reset Request";
        desc = "We received a request to reset your CodeSync AI password. Enter the code below to proceed:";
    }

    const htmlContent = getEmailTemplate(otp, title, desc);
    const transport = getTransporter();

    return await transport.sendMail({
        from: process.env.SMTP_FROM || '"CodeSync AI" <no-reply@codesync.ai>',
        to: email,
        subject: `[CodeSync AI] ${otp} is your ${purpose === "reset_password" ? "password reset" : "verification"} code`,
        text: `Your CodeSync AI 6-digit code is: ${otp}. It expires in 10 minutes.`,
        html: htmlContent,
    });
}

module.exports = {
    sendOtpEmail,
};
