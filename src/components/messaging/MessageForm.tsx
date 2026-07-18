import React, { useState, ChangeEvent, FormEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useUsers } from '../../hooks/users';
import { useSendMessage } from '../../hooks/users/useMessaging';
import type { User, Message } from '../../types';

interface MessageFormData {
  recipientId: string;
  subject: string;
  content: string;
}

interface FormErrors {
  recipientId?: string | null;
  subject?: string | null;
  content?: string | null;
  submit?: string | null;
}

interface MessageFormProps {
  recipientId?: string | null;
  recipientUser?: User | null;
  replyToMessage?: Message | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const MessageForm: React.FC<MessageFormProps> = ({
  recipientId = null,
  recipientUser = null,
  replyToMessage = null,
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState<MessageFormData>({
    recipientId: recipientId || '',
    subject: replyToMessage ? `Re: ${replyToMessage.subject}` : '',
    content: '',
  });
  const [selectedRecipient, setSelectedRecipient] = useState<User | null>(recipientUser);
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch users for recipient selection
  const { data: users = [], isLoading: loadingUsers } = useUsers();

  // Send message mutation
  const sendMessageMutation = useSendMessage({
    onSuccess: () => {
      setFormData({ recipientId: '', subject: '', content: '' });
      setSelectedRecipient(null);
      setErrors({});
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      setErrors({ submit: error.message || 'Failed to send message' });
    },
  });

  const handleInputChange = (field: keyof MessageFormData, value: string): void => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleRecipientChange = (_event: React.SyntheticEvent, newValue: User | null): void => {
    setSelectedRecipient(newValue);
    const userId = newValue ? (newValue as User & { _id?: string })._id || newValue.id || '' : '';
    setFormData((prev) => ({
      ...prev,
      recipientId: userId,
    }));
    if (errors.recipientId) {
      setErrors((prev) => ({ ...prev, recipientId: null }));
    }
  };

  const getUserId = (option: User): string =>
    (option as User & { _id?: string })._id || option.id || '';

  const handleRecipientSelect = (value: string): void => {
    const found = (users as User[]).find((option) => getUserId(option) === value) || null;
    handleRecipientChange({} as React.SyntheticEvent, found);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.recipientId) {
      newErrors.recipientId = 'Please select a recipient';
    }
    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }
    if (!formData.content.trim()) {
      newErrors.content = 'Message content is required';
    }
    if (formData.subject.length > 100) {
      newErrors.subject = 'Subject must be 100 characters or less';
    }
    if (formData.content.length > 1000) {
      newErrors.content = 'Message must be 1000 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    sendMessageMutation.mutate({
      recipientId: formData.recipientId,
      subject: formData.subject.trim(),
      content: formData.content.trim(),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {replyToMessage ? 'Reply to Message' : 'Send New Message'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipient Selection */}
          {!recipientId && (
            <div className="space-y-1.5">
              <Label htmlFor="recipient">Recipient</Label>
              <Select
                value={selectedRecipient ? getUserId(selectedRecipient) : ''}
                onValueChange={handleRecipientSelect}
                disabled={loadingUsers}
              >
                <SelectTrigger
                  id="recipient"
                  className={cn('w-full', errors.recipientId && 'border-destructive')}
                  aria-invalid={!!errors.recipientId}
                >
                  <SelectValue
                    placeholder={loadingUsers ? 'Loading recipients…' : 'Select a recipient'}
                  />
                  {loadingUsers && <Loader2 className="size-4 animate-spin" />}
                </SelectTrigger>
                <SelectContent>
                  {(users as User[]).map((option) => (
                    <SelectItem key={getUserId(option)} value={getUserId(option)}>
                      {`${option.username} (${option.firstName} ${option.lastName})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.recipientId && (
                <p className="text-xs text-destructive">{errors.recipientId}</p>
              )}
            </div>
          )}

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handleInputChange('subject', e.target.value)
              }
              maxLength={100}
              aria-invalid={!!errors.subject}
              className={cn(errors.subject && 'border-destructive')}
            />
            <p
              className={cn(
                'text-xs',
                errors.subject ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {errors.subject || `${formData.subject.length}/100 characters`}
            </p>
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label htmlFor="content">Message</Label>
            <Textarea
              id="content"
              rows={6}
              value={formData.content}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                handleInputChange('content', e.target.value)
              }
              maxLength={1000}
              aria-invalid={!!errors.content}
              className={cn(errors.content && 'border-destructive')}
            />
            <p
              className={cn(
                'text-xs',
                errors.content ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {errors.content || `${formData.content.length}/1000 characters`}
            </p>
          </div>

          {/* Error Alert */}
          {errors.submit && (
            <Alert variant="destructive">
              <AlertDescription>{errors.submit}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={sendMessageMutation.isPending}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={sendMessageMutation.isPending}>
              {sendMessageMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {sendMessageMutation.isPending ? 'Sending...' : 'Send Message'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default MessageForm;
