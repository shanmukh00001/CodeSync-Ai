const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { sendOtpEmail } = require("./emailService");

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

/**
 * Generates a cryptographically secure 6-digit numeric OTP string
 */
function generate6DigitOtp() {
    return crypto.randomInt(100000, 999999).toString();
}

/**
 * Creates and sets an OTP secret on a user model instance, then dispatches the email
 */
async function issueUserOtp(user, purpose = "verification") {
    const rawOtp = generate6DigitOtp();
    const codeHash = await bcrypt.hash(rawOtp, 10);

    user.otpSecret = {
        codeHash,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
        purpose,
        attempts: 0,
    };

    await user.save();

    // Dispatch email
    await sendOtpEmail(user.email, rawOtp, purpose);
    return { success: true, expiresAt: user.otpSecret.expiresAt };
}

/**
 * Validates a user-supplied OTP code against the user model instance
 */
async function verifyUserOtp(user, rawOtp, expectedPurpose) {
    if (!user.otpSecret || !user.otpSecret.codeHash) {
        return { valid: false, error: "NO_ACTIVE_OTP", message: "No active verification code found. Please request a new code." };
    }

    if (expectedPurpose && user.otpSecret.purpose !== expectedPurpose) {
        return { valid: false, error: "PURPOSE_MISMATCH", message: "Invalid code for this operation." };
    }

    if (new Date() > new Date(user.otpSecret.expiresAt)) {
        user.otpSecret = undefined;
        await user.save();
        return { valid: false, error: "OTP_EXPIRED", message: "Verification code has expired. Please request a new one." };
    }

    if (user.otpSecret.attempts >= MAX_ATTEMPTS) {
        user.otpSecret = undefined;
        await user.save();
        return { valid: false, error: "MAX_ATTEMPTS_EXCEEDED", message: "Too many incorrect attempts. Please request a new code." };
    }

    const isMatch = await bcrypt.compare(rawOtp.trim(), user.otpSecret.codeHash);

    if (!isMatch) {
        user.otpSecret.attempts += 1;
        await user.save();
        const remaining = MAX_ATTEMPTS - user.otpSecret.attempts;
        return {
            valid: false,
            error: "INVALID_OTP",
            message: `Incorrect verification code. ${remaining} attempt(s) remaining.`,
        };
    }

    // Success: Clear OTP secret
    user.otpSecret = undefined;
    if (expectedPurpose === "verification") {
        user.isEmailVerified = true;
    }
    await user.save();

    return { valid: true, message: "Code verified successfully." };
}

module.exports = {
    generate6DigitOtp,
    issueUserOtp,
    verifyUserOtp,
};
