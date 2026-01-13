const nodemailer = require('nodemailer');
const config = require('../config');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }

  async sendEmail({ to, subject, html, text }) {
    try {
      const mailOptions = {
        from: config.smtp.from,
        to,
        subject,
        html,
        text,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Email send failed:', error);
      return { success: false, error: error.message };
    }
  }

  async sendOTP(email, otp, type = 'verification') {
    const subject = type === 'verification' 
      ? 'RMV Stainless Steel - Verify Your Email'
      : 'RMV Stainless Steel - Password Reset';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1a1a2e; color: white; padding: 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 30px; background-color: #f9f9f9; }
          .otp-box { background-color: #1a1a2e; color: white; font-size: 32px; font-weight: bold; 
                     text-align: center; padding: 20px; margin: 20px 0; letter-spacing: 8px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .warning { color: #e74c3c; font-size: 14px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>RMV Stainless Steel</h1>
          </div>
          <div class="content">
            <h2>${type === 'verification' ? 'Verify Your Email Address' : 'Reset Your Password'}</h2>
            <p>Your verification code is:</p>
            <div class="otp-box">${otp}</div>
            <p>This code will expire in <strong>10 minutes</strong>.</p>
            <p class="warning">If you didn't request this code, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>RMV Stainless Steel Fabrication & Construction Services</p>
            <p>Brgy. Mapulang Lupa, Valenzuela City</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `Your ${type === 'verification' ? 'verification' : 'password reset'} code is: ${otp}. This code expires in 10 minutes.`,
    });
  }

  async sendAppointmentConfirmation(email, appointment, customerName) {
    const date = new Date(appointment.scheduledDate);
    const formattedDate = date.toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = date.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1a1a2e; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background-color: #f9f9f9; }
          .details { background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #1a1a2e; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .cta { background-color: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; 
                 display: inline-block; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Appointment Confirmed</h1>
          </div>
          <div class="content">
            <p>Hello ${customerName},</p>
            <p>Your appointment has been confirmed. Here are the details:</p>
            <div class="details">
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${formattedTime}</p>
              <p><strong>Type:</strong> ${appointment.appointmentType === 'ocular_visit' ? 'Ocular Visit' : 'Office Consultation'}</p>
              ${appointment.interestedCategory ? `<p><strong>Category:</strong> ${appointment.interestedCategory}</p>` : ''}
            </div>
            <p>Please arrive 10 minutes before your scheduled time.</p>
            <p>If you need to reschedule, please contact us at least 24 hours in advance.</p>
            <a href="${config.frontendUrl}/customer/appointments" class="cta">View Appointment</a>
          </div>
          <div class="footer">
            <p>RMV Stainless Steel Fabrication & Construction Services</p>
            <p>Brgy. Mapulang Lupa, Valenzuela City</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'RMV Stainless Steel - Appointment Confirmation',
      html,
      text: `Your appointment is confirmed for ${formattedDate} at ${formattedTime}.`,
    });
  }

  async sendAppointmentCancellation(email, details, customerName) {
    const date = new Date(details.scheduledDate);
    const formattedDate = date.toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = date.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const reason = details.reason || 'Appointment cancelled';
    const message = details.message || 'Your appointment has been cancelled. You can book a new schedule anytime.';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #e11d48; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background-color: #f9f9f9; }
          .details { background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #e11d48; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .cta { background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none;
                 display: inline-block; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Appointment Cancelled</h1>
          </div>
          <div class="content">
            <p>Hello ${customerName || 'Customer'},</p>
            <p>We’re letting you know that your appointment has been cancelled.</p>
            <div class="details">
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${formattedTime}</p>
              <p><strong>Type:</strong> ${details.appointmentType === 'ocular_visit' ? 'Ocular Visit' : 'Office Consultation'}</p>
              <p><strong>Reason:</strong> ${reason}</p>
            </div>
            <p>${message}</p>
            <p>If you’d like to reschedule, please pick a new time that works for you.</p>
            <a href="${config.frontendUrl}/customer/appointments" class="cta">Book A New Appointment</a>
          </div>
          <div class="footer">
            <p>RMV Stainless Steel Fabrication & Construction Services</p>
            <p>Brgy. Mapulang Lupa, Valenzuela City</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'RMV Stainless Steel - Appointment Cancelled',
      html,
      text: `Your appointment on ${formattedDate} at ${formattedTime} has been cancelled. Reason: ${reason}. Message: ${message}`,
    });
  }

  async sendBlueprintReady(email, project, customerName) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1a1a2e; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background-color: #f9f9f9; }
          .project-box { background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #1a1a2e; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .cta { background-color: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; 
                 display: inline-block; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Blueprint Ready for Review</h1>
          </div>
          <div class="content">
            <p>Hello ${customerName},</p>
            <p>Great news! The blueprint and costing for your project are now ready for your review.</p>
            <div class="project-box">
              <p><strong>Project:</strong> ${project.title}</p>
              <p><strong>Project Number:</strong> ${project.projectNumber}</p>
              <p><strong>Category:</strong> ${project.category}</p>
            </div>
            <p>Please log in to your dashboard to review the blueprint and costing. You can approve the project or request revisions if needed.</p>
            <a href="${config.frontendUrl}/customer/projects/${project._id}" class="cta">Review Project</a>
          </div>
          <div class="footer">
            <p>RMV Stainless Steel Fabrication & Construction Services</p>
            <p>Brgy. Mapulang Lupa, Valenzuela City</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `RMV Stainless Steel - Blueprint Ready: ${project.projectNumber}`,
      html,
      text: `Your blueprint for project ${project.projectNumber} is ready for review.`,
    });
  }

  async sendPaymentVerification(email, payment, project, customerName) {
    const stageNames = {
      initial: 'Initial Payment (30%)',
      midpoint: 'Midpoint Payment (40%)',
      final: 'Final Payment (30%)',
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #27ae60; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background-color: #f9f9f9; }
          .payment-box { background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #27ae60; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .amount { font-size: 24px; font-weight: bold; color: #27ae60; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Verified ✓</h1>
          </div>
          <div class="content">
            <p>Hello ${customerName},</p>
            <p>Your payment has been verified successfully.</p>
            <div class="payment-box">
              <p><strong>Project:</strong> ${project.projectNumber}</p>
              <p><strong>Payment Stage:</strong> ${stageNames[payment.stage]}</p>
              <p class="amount">₱${payment.amount.received?.toLocaleString()}</p>
              <p><strong>Reference:</strong> ${payment.verification.referenceNumber || 'N/A'}</p>
            </div>
            <p>Thank you for your payment. Your project will proceed to the next phase.</p>
          </div>
          <div class="footer">
            <p>RMV Stainless Steel Fabrication & Construction Services</p>
            <p>Brgy. Mapulang Lupa, Valenzuela City</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `RMV Stainless Steel - Payment Verified: ${project.projectNumber}`,
      html,
      text: `Your ${stageNames[payment.stage]} for project ${project.projectNumber} has been verified.`,
    });
  }

  async sendProjectStatusUpdate(email, project, customerName, newStatus) {
    const statusMessages = {
      approved: 'Your project has been approved and is ready to proceed!',
      in_fabrication: 'Great news! Fabrication has started on your project.',
      ready_for_installation: 'Your project is ready for installation!',
      in_installation: 'Installation is now in progress.',
      completed: 'Congratulations! Your project has been completed!',
    };

    const message = statusMessages[newStatus] || `Your project status has been updated to: ${newStatus}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1a1a2e; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .cta { background-color: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; 
                 display: inline-block; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Project Update</h1>
          </div>
          <div class="content">
            <p>Hello ${customerName},</p>
            <p>${message}</p>
            <p><strong>Project:</strong> ${project.projectNumber} - ${project.title}</p>
            <a href="${config.frontendUrl}/customer/projects/${project._id}" class="cta">View Project</a>
          </div>
          <div class="footer">
            <p>RMV Stainless Steel Fabrication & Construction Services</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `RMV Stainless Steel - Project Update: ${project.projectNumber}`,
      html,
      text: message,
    });
  }
}

module.exports = new EmailService();
