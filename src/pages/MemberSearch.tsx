import React, { useState, FormEvent, ChangeEvent } from 'react';
import { Search, MessageSquare, Eye, SlidersHorizontal, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Avatar from '../components/common/Avatar';
import { useAuth } from '../hooks/auth';
import { useUserSearch, useSendMessage } from '../hooks/users';
import type { User } from '../types';

interface SearchParams {
  query: string;
  skills: string;
  experience: string;
  availability: string;
  location: string;
  [key: string]: string | undefined;
}

interface MessageData {
  subject: string;
  content: string;
}

interface SelectOption {
  value: string;
  label: string;
}

// Extended User type with _id
interface UserWithId extends Omit<User, 'id'> {
  _id: string;
  id?: string;
}

const metaLabel = 'font-mono text-[11px] uppercase tracking-widest text-muted-foreground';
const ANY = '__any__';

const MemberSearch: React.FC = () => {
  // Auth and messaging
  const { user } = useAuth();
  const sendMessageMutation = useSendMessage();

  const [searchParams, setSearchParams] = useState<SearchParams>({
    query: '',
    skills: '',
    experience: '',
    availability: '',
    location: '',
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithId | null>(null);
  const [messageDialog, setMessageDialog] = useState(false);
  const [messageData, setMessageData] = useState<MessageData>({
    subject: '',
    content: '',
  });

  // Use the search hook - convert local SearchParams to UserSearchParams format
  // The hook enables itself based on the 'search' field
  const hasSearchQuery = Boolean(
    searchParams.query ||
    searchParams.skills ||
    searchParams.experience ||
    searchParams.availability ||
    searchParams.location
  );

  const {
    data: searchResults = [],
    isLoading: searchLoading,
    error: searchError,
    refetch: performSearch,
  } = useUserSearch({
    search: searchParams.query || undefined,
    skills: searchParams.skills || undefined,
    experience: searchParams.experience || undefined,
    availability: searchParams.availability || undefined,
  });

  const handleSearch = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    performSearch();
  };

  const handleSendMessage = async (): Promise<void> => {
    if (!selectedUser) return;

    sendMessageMutation.mutate(
      {
        recipientId: selectedUser._id,
        subject: messageData.subject,
        content: messageData.content,
      },
      {
        onSuccess: (data) => {
          console.log('✅ Message sent successfully:', data);
          setMessageDialog(false);
          setMessageData({ subject: '', content: '' });
          setSelectedUser(null);
        },
        onError: (error) => {
          console.error('❌ Failed to send message:', error);
        },
      }
    );
  };

  const handleViewProfile = (user: UserWithId): void => {
    setSelectedUser(user);
  };

  const handleMessageUser = (user: UserWithId): void => {
    setSelectedUser(user);
    setMessageDialog(true);
  };

  const experienceLevels: SelectOption[] = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
    { value: 'expert', label: 'Expert' },
  ];

  const availabilityOptions: SelectOption[] = [
    { value: 'full-time', label: 'Full-time' },
    { value: 'part-time', label: 'Part-time' },
    { value: 'weekends', label: 'Weekends' },
    { value: 'evenings', label: 'Evenings' },
    { value: 'flexible', label: 'Flexible' },
  ];

  const typedResults = searchResults as UserWithId[];

  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="mb-8 mt-8">
        <p className={`${metaLabel} text-center`}>find collaborators</p>
        <h1 className="text-center text-3xl font-bold tracking-tight text-foreground">
          Find Collaborators
        </h1>
        <p className="mb-8 mt-2 text-center text-muted-foreground">
          Search for members with specific skills and experience
        </p>

        {/* Search Form */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <form onSubmit={handleSearch}>
              <div className="grid items-end gap-4 md:grid-cols-12">
                <div className="space-y-1.5 md:col-span-4">
                  <Label htmlFor="query">Search by name, skills, or bio</Label>
                  <Input
                    id="query"
                    name="query"
                    value={searchParams.query}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setSearchParams((prev) => ({ ...prev, query: e.target.value }))
                    }
                    placeholder="e.g., React, Python, Full Stack"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-3">
                  <Label htmlFor="skills">Skills (comma-separated)</Label>
                  <Input
                    id="skills"
                    name="skills"
                    value={searchParams.skills}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setSearchParams((prev) => ({ ...prev, skills: e.target.value }))
                    }
                    placeholder="React, Node.js, MongoDB"
                  />
                </div>

                <div className="md:col-span-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <SlidersHorizontal className="size-4" />
                    Filters
                  </Button>
                </div>

                <div className="md:col-span-3">
                  <Button type="submit" className="w-full" disabled={searchLoading}>
                    <Search className="size-4" />
                    {searchLoading ? 'Searching...' : 'Search'}
                  </Button>
                </div>
              </div>

              {/* Advanced Filters */}
              {showFilters && (
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="experience">Experience Level</Label>
                    <Select
                      name="experience"
                      value={searchParams.experience || ANY}
                      onValueChange={(value) =>
                        setSearchParams((prev) => ({
                          ...prev,
                          experience: value === ANY ? '' : value,
                        }))
                      }
                    >
                      <SelectTrigger id="experience" className="w-full">
                        <SelectValue placeholder="Any Experience" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ANY}>Any Experience</SelectItem>
                        {experienceLevels.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="availability">Availability</Label>
                    <Select
                      name="availability"
                      value={searchParams.availability || ANY}
                      onValueChange={(value) =>
                        setSearchParams((prev) => ({
                          ...prev,
                          availability: value === ANY ? '' : value,
                        }))
                      }
                    >
                      <SelectTrigger id="availability" className="w-full">
                        <SelectValue placeholder="Any Availability" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ANY}>Any Availability</SelectItem>
                        {availabilityOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      name="location"
                      value={searchParams.location}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setSearchParams((prev) => ({ ...prev, location: e.target.value }))
                      }
                      placeholder="City, Country"
                    />
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Error Display */}
        {searchError && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              {(searchError as Error & { response?: { data?: { message?: string } } })?.response
                ?.data?.message ||
                (searchError as Error)?.message ||
                'Search failed'}
            </AlertDescription>
          </Alert>
        )}

        {/* Search Results */}
        {typedResults.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {typedResults.map((member) => (
              <Card
                key={member._id}
                className="flex flex-col transition-colors hover:border-primary/40"
              >
                <CardContent className="flex-1 pt-6">
                  <div className="mb-4 flex items-center gap-3">
                    <Avatar user={member as unknown as User} size="md" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {member.firstName && member.lastName
                          ? `${member.firstName} ${member.lastName}`
                          : member.username}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">@{member.username}</p>
                    </div>
                  </div>

                  {member.bio && <p className="mb-4 text-sm text-foreground">{member.bio}</p>}

                  {member.skills && member.skills.length > 0 && (
                    <div className="mb-4">
                      <p className={`${metaLabel} mb-1.5`}>Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {member.skills.slice(0, 5).map((skill) => (
                          <Badge key={skill} variant="secondary">
                            {skill}
                          </Badge>
                        ))}
                        {member.skills.length > 5 && (
                          <Badge variant="secondary">{`+${member.skills.length - 5} more`}</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {member.experience && (
                      <Badge variant="outline" className="text-primary">
                        {member.experience}
                      </Badge>
                    )}
                    {member.availability && (
                      <Badge variant="outline">{member.availability}</Badge>
                    )}
                  </div>

                  {member.location && (
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" />
                      {member.location}
                    </p>
                  )}
                </CardContent>

                <CardFooter className="gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleViewProfile(member)}
                  >
                    <Eye className="size-4" />
                    View Profile
                  </Button>
                  {member._id !== (user as UserWithId | null)?._id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMessageUser(member)}
                    >
                      <MessageSquare className="size-4" />
                      Message
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {typedResults.length === 0 && !searchLoading && hasSearchQuery && (
          <div className="py-8 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              No members found matching your criteria
            </p>
            <p className="text-sm text-muted-foreground">Try adjusting your search parameters</p>
          </div>
        )}
      </div>

      {/* Message Dialog */}
      <Dialog
        open={messageDialog}
        onOpenChange={(open) => {
          if (!open) setMessageDialog(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Send Message to{' '}
              {selectedUser?.firstName && selectedUser?.lastName
                ? `${selectedUser.firstName} ${selectedUser.lastName}`
                : selectedUser?.username}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="message-subject">Subject</Label>
              <Input
                id="message-subject"
                value={messageData.subject}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setMessageData((prev) => ({ ...prev, subject: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message-content">Message</Label>
              <Textarea
                id="message-content"
                rows={4}
                value={messageData.content}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  setMessageData((prev) => ({ ...prev, content: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={
                !messageData.subject.trim() ||
                !messageData.content.trim() ||
                sendMessageMutation.isPending
              }
            >
              {sendMessageMutation.isPending ? 'Sending...' : 'Send Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MemberSearch;
