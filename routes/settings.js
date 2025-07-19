const { Router } = require("express");
const { randomBytes } = require("crypto");
const User = require("../models/user");
const { sendEmail } = require("../middlewares/nodemailer");
const cloudinaryUpload = require("../middlewares/cloudinaryUpload");
const { createTokenForUser } = require("../services/authentication");

const router = Router();

// GET /settings
router.get("/", (req, res) => {
  if (!req.user) {
    return res.redirect("/user/signin?error_msg=Please log in to view settings");
  }
  return res.render("settings", {
    user: req.user,
    success_msg: req.query.success_msg,
    error_msg: req.query.error_msg,
  });
});

// POST /settings/update-profile
router.post("/update-profile", cloudinaryUpload.single("profileImage"), async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect("/user/signin?error_msg=Please log in to update your profile");
    }

    const { fullname, bio } = req.body;
    const update = {};

    if (fullname?.trim()) {
      if (fullname.trim().length < 2) {
        return res.redirect("/settings?error_msg=Username must be at least 2 characters");
      }
      update.fullname = fullname.trim();
    }

    if (bio?.trim()) {
      update.bio = bio.trim();
    }

    if (req.file) {
      update.profileImageURL = req.file.path; // Cloudinary URL
    }

    if (!Object.keys(update).length) {
      return res.redirect("/settings?error_msg=No changes provided");
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, update, { new: true });
    if (!updatedUser) return res.redirect("/settings?error_msg=User not found");

    const token = createTokenForUser(updatedUser);
    res.cookie("token", token, { httpOnly: true });
    return res.redirect("/settings?success_msg=Profile updated successfully");
  } catch (err) {
    console.error("Error updating profile:", err);
    return res.redirect("/settings?error_msg=Failed to update profile");
  }
});

// POST /settings/request-password-reset
router.post("/request-password-reset", async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ success: false, error: "Please log in" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.json({ success: false, error: "User not found" });
    }

    const resetToken = randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiry
    await user.save();

    const resetUrl = `http://${req.headers.host}/settings/reset-password/${user._id}/${resetToken}`;
    await sendEmail({
      to: user.email,
      subject: "Blogify Password Reset",
      html: `
        <h2>Reset Your Blogify Password</h2>
        <p>Please click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link expires in 1 hour.</p>
      `,
    });

    return res.json({ success: true, message: "Password reset link sent to your email" });
  } catch (error) {
    console.error("Error sending reset link:", error);
    return res.json({ success: false, error: "Failed to send password reset link" });
  }
});

// GET /settings/reset-password/:userId/:token
router.get("/reset-password/:userId/:token", async (req, res) => {
  try {
    const { userId, token } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect("/settings?error_msg=User not found");
    }
    if (user.resetPasswordToken !== token) {
      return res.redirect("/settings?error_msg=Invalid reset link");
    }
    if (user.resetPasswordExpires < Date.now()) {
      return res.redirect("/settings?error_msg=Reset link expired");
    }

    return res.render("profile-reset-password", {
      userId,
      token,
      success_msg: null,
      error_msg: null,
    });
  } catch (error) {
    console.error("Error in reset-password GET:", error);
    return res.redirect("/settings?error_msg=Failed to validate reset link");
  }
});

// POST /settings/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { userId, token, password, confirmPassword } = req.body;
    if (password.length < 8) {
      return res.render("profile-reset-password", {
        userId,
        token,
        success_msg: null,
        error_msg: "Password must be at least 8 characters",
      });
    }
    if (password !== confirmPassword) {
      return res.render("profile-reset-password", {
        userId,
        token,
        success_msg: null,
        error_msg: "Passwords do not match",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.redirect("/settings?error_msg=User not found");
    }
    if (user.resetPasswordToken !== token) {
      return res.redirect("/settings?error_msg=Invalid reset link");
    }
    if (user.resetPasswordExpires < Date.now()) {
      return res.redirect("/settings?error_msg=Reset link expired");
    }

    user.password = password; // Password will be hashed in pre-save hook
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    const tokenJwt = createTokenForUser(user);
    res.cookie("token", tokenJwt, { httpOnly: true });
    return res.redirect("/settings?success_msg=Password updated successfully");
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.render("profile-reset-password", {
      userId: req.body.userId,
      token: req.body.token,
      success_msg: null,
      error_msg: "Failed to reset password",
    });
  }
});

module.exports = router;
