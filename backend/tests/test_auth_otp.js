const mongoose = require("mongoose");
const assert = require("assert");
const { generate6DigitOtp, issueUserOtp, verifyUserOtp } = require("./services/otpService");
const User = require("./models/User");
require("dotenv").config();

async function runTests() {
    console.log("=== STARTING AUTH, OTP & ADMIN AUTOMATED TEST SUITE ===");

    // 1. Test OTP Generation format
    const otp = generate6DigitOtp();
    assert.strictEqual(otp.length, 6, "OTP should be 6 digits");
    assert.match(otp, /^[0-9]{6}$/, "OTP should be purely numeric");
    console.log("✓ Test 1 Passed: 6-digit OTP generation verified.");

    // 2. Mock User & OTP Verification flow
    const mockUser = {
        name: "Test Developer",
        email: "test.dev@codesync.ai",
        role: "user",
        isEmailVerified: false,
        save: async function () { return this; }
    };

    // Issue OTP
    const issued = await issueUserOtp(mockUser, "verification");
    assert.strictEqual(issued.success, true, "OTP issue should succeed");
    assert.ok(mockUser.otpSecret.codeHash, "OTP secret hash must be set");
    assert.strictEqual(mockUser.otpSecret.purpose, "verification");
    console.log("✓ Test 2 Passed: OTP issuance and hash storage verified.");

    // Test Invalid OTP attempt
    const invalidResult = await verifyUserOtp(mockUser, "000000", "verification");
    assert.strictEqual(invalidResult.valid, false, "Invalid code should be rejected");
    assert.strictEqual(mockUser.otpSecret.attempts, 1, "Attempt counter should increment");
    console.log("✓ Test 3 Passed: Invalid OTP attempt rejection and throttle count verified.");

    // Test Valid OTP attempt (retrieve raw from service by re-running verification simulation)
    const freshOtp = generate6DigitOtp();
    const bcrypt = require("bcryptjs");
    mockUser.otpSecret.codeHash = await bcrypt.hash(freshOtp, 10);
    mockUser.otpSecret.attempts = 0;

    const validResult = await verifyUserOtp(mockUser, freshOtp, "verification");
    assert.strictEqual(validResult.valid, true, "Valid code must pass");
    assert.strictEqual(mockUser.isEmailVerified, true, "User email status should become verified");
    assert.strictEqual(mockUser.otpSecret, undefined, "OTP secret should be cleared after consumption");
    console.log("✓ Test 4 Passed: Valid OTP verification and email verification state mutation verified.");

    // 5. Test Expired OTP handling
    mockUser.otpSecret = {
        codeHash: await bcrypt.hash("123456", 10),
        expiresAt: new Date(Date.now() - 10000), // in the past
        purpose: "verification",
        attempts: 0
    };
    const expiredResult = await verifyUserOtp(mockUser, "123456", "verification");
    assert.strictEqual(expiredResult.valid, false, "Expired code must be rejected");
    assert.strictEqual(expiredResult.error, "OTP_EXPIRED");
    console.log("✓ Test 5 Passed: Expired OTP rejection verified.");

    console.log("\n=======================================================");
    console.log("🎉 ALL 5 INTEGRATION & AUTH UNIT TESTS PASSED CLEANLY!");
    console.log("=======================================================\n");
}

runTests().catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});
