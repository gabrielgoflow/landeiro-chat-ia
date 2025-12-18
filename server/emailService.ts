const TOKEN = process.env.MAILTRAP_API_TOKEN || "4b9631bf568ec0a31265e6b183598650";
const TEST_INBOX_ID = process.env.MAILTRAP_TEST_INBOX_ID || "4266022";

const sender = {
  email: "hello@example.com",
  name: "Landeiro Chat IA",
};

/**
 * Envia email de reset de senha via Mailtrap
 * @param email - Email do destinatário
 * @param resetUrl - URL completa com token para reset de senha
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<void> {
  const recipients = [
    {
      email: email,
    },
  ];

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset de Senha - Landeiro Chat IA</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
        <h1 style="color: #2563eb; margin-top: 0;">Redefinir Senha</h1>
        <p>Olá,</p>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta no Landeiro Chat IA.</p>
        <p>Clique no botão abaixo para criar uma nova senha:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Redefinir Senha
          </a>
        </div>
        <p>Ou copie e cole o link abaixo no seu navegador:</p>
        <p style="word-break: break-all; background-color: #e5e7eb; padding: 10px; border-radius: 4px; font-size: 12px;">
          ${resetUrl}
        </p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          <strong>Importante:</strong> Este link expira em 1 hora. Se você não solicitou esta redefinição, ignore este email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          Este é um email automático, por favor não responda.
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Redefinir Senha - Landeiro Chat IA

Olá,

Recebemos uma solicitação para redefinir a senha da sua conta no Landeiro Chat IA.

Acesse o link abaixo para criar uma nova senha:

${resetUrl}

Importante: Este link expira em 1 hora. Se você não solicitou esta redefinição, ignore este email.

Este é um email automático, por favor não responda.
  `.trim();

  try {
    // Usar a API REST do Mailtrap diretamente
    // POST https://sandbox.api.mailtrap.io/api/send/{inbox_id}
    const response = await fetch(`https://sandbox.api.mailtrap.io/api/send/${TEST_INBOX_ID}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Api-Token": TOKEN,
      },
      body: JSON.stringify({
        from: sender,
        to: recipients,
        subject: "Redefinir Senha - Landeiro Chat IA",
        text: textContent,
        html: htmlContent,
        category: "Password Reset",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mailtrap API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`Email de reset de senha enviado para: ${email}`, result);
  } catch (error: any) {
    console.error("Erro ao enviar email de reset de senha:", error);
    throw new Error(`Falha ao enviar email: ${error.message || "Erro desconhecido"}`);
  }
}
