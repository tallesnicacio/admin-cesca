import { supabase } from '../supabaseClient';
import { sendConfirmationEmail } from './emailService';

vi.mock('../supabaseClient', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

describe('sendConfirmationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-de-teste' } },
    });
  });

  it('envia o id e a opção escolhida para a API', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { message: 'Email enviado com sucesso', emailId: 'email-123' },
      error: null,
    });

    const result = await sendConfirmationEmail('agendamento-123', 'segunda');

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'send-confirmation-email',
      {
        body: {
          agendamentoId: 'agendamento-123',
          opcaoEscolhida: 'segunda',
        },
      }
    );
    expect(result).toEqual({
      success: true,
      message: 'Email enviado com sucesso',
      emailId: 'email-123',
    });
  });

  it('propaga a mensagem de erro retornada pela API', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'Somente agendamentos confirmados' },
    });

    const result = await sendConfirmationEmail('agendamento-pendente');

    expect(result).toEqual({
      success: false,
      error: 'Somente agendamentos confirmados',
    });
  });

  it('não chama a API quando não existe sessão ativa', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });

    const result = await sendConfirmationEmail('agendamento-123');

    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      error: 'Usuário não autenticado',
    });
  });
});
