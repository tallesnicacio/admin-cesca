import toast from 'react-hot-toast';

// Input Components
export {
  Input,
  PhoneInput,
  Select,
  Textarea,
  RadioGroup,
  Checkbox
} from './Input';

// Button Components
export {
  Button,
  LoadingSpinner,
  LoadingOverlay
} from './Button';

// Card Components
export {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  ProgressBar,
  Alert
} from './Card';

// Toast (re-export from react-hot-toast with custom config)
export { toast, Toaster } from 'react-hot-toast';

// Modal Components
export {
  Modal,
  ConfirmModal,
  PromptModal,
  SelectModal
} from './Modal';

// Custom toast helpers
export const showToast = {
  success: (message) => toast.success(message, {
    duration: 4000,
    style: {
      background: '#10b981',
      color: '#fff',
      padding: '16px',
      borderRadius: '12px',
      fontWeight: '500',
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#10b981',
    },
  }),

  error: (message) => toast.error(message, {
    duration: 5000,
    style: {
      background: '#ef4444',
      color: '#fff',
      padding: '16px',
      borderRadius: '12px',
      fontWeight: '500',
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#ef4444',
    },
  }),

  loading: (message) => toast.loading(message, {
    style: {
      background: '#667eea',
      color: '#fff',
      padding: '16px',
      borderRadius: '12px',
      fontWeight: '500',
    },
  }),

  promise: (promise, messages) => toast.promise(
    promise,
    {
      loading: messages.loading || 'Carregando...',
      success: messages.success || 'Concluído!',
      error: messages.error || 'Erro!',
    },
    {
      style: {
        padding: '16px',
        borderRadius: '12px',
        fontWeight: '500',
      },
    }
  ),
};
