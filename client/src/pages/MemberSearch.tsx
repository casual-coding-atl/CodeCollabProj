import React, { useState, FormEvent, ChangeEvent } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  Box,
  Paper,
  Alert,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  SelectChangeEvent,
} from '@mui/material';
import { Search, Message, Visibility, FilterList } from '@mui/icons-material';
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
        recipient: selectedUser._id,
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
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Find Collaborators
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
          Search for members with specific skills and experience
        </Typography>

        {/* Search Form */}
        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
          <Box component="form" onSubmit={handleSearch}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Search by name, skills, or bio"
                  name="query"
                  value={searchParams.query}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setSearchParams((prev) => ({ ...prev, query: e.target.value }))
                  }
                  placeholder="e.g., React, Python, Full Stack"
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Skills (comma-separated)"
                  name="skills"
                  value={searchParams.skills}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setSearchParams((prev) => ({ ...prev, skills: e.target.value }))
                  }
                  placeholder="React, Node.js, MongoDB"
                />
              </Grid>

              <Grid item xs={12} md={2}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => setShowFilters(!showFilters)}
                  startIcon={<FilterList />}
                >
                  Filters
                </Button>
              </Grid>

              <Grid item xs={12} md={3}>
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  disabled={searchLoading}
                  startIcon={<Search />}
                >
                  {searchLoading ? 'Searching...' : 'Search'}
                </Button>
              </Grid>
            </Grid>

            {/* Advanced Filters */}
            {showFilters && (
              <Box sx={{ mt: 3 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>Experience Level</InputLabel>
                      <Select
                        name="experience"
                        value={searchParams.experience}
                        onChange={(e: SelectChangeEvent) =>
                          setSearchParams((prev) => ({ ...prev, experience: e.target.value }))
                        }
                        label="Experience Level"
                      >
                        <MenuItem value="">Any Experience</MenuItem>
                        {experienceLevels.map((level) => (
                          <MenuItem key={level.value} value={level.value}>
                            {level.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>Availability</InputLabel>
                      <Select
                        name="availability"
                        value={searchParams.availability}
                        onChange={(e: SelectChangeEvent) =>
                          setSearchParams((prev) => ({ ...prev, availability: e.target.value }))
                        }
                        label="Availability"
                      >
                        <MenuItem value="">Any Availability</MenuItem>
                        {availabilityOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Location"
                      name="location"
                      value={searchParams.location}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setSearchParams((prev) => ({ ...prev, location: e.target.value }))
                      }
                      placeholder="City, Country"
                    />
                  </Grid>
                </Grid>
              </Box>
            )}
          </Box>
        </Paper>

        {/* Error Display */}
        {searchError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {(searchError as Error & { response?: { data?: { message?: string } } })?.response?.data
              ?.message ||
              (searchError as Error)?.message ||
              'Search failed'}
          </Alert>
        )}

        {/* Search Results */}
        {typedResults.length > 0 && (
          <Grid container spacing={3}>
            {typedResults.map((member) => (
              <Grid item xs={12} md={6} lg={4} key={member._id}>
                <Card elevation={2}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar sx={{ mr: 2 }}>
                        {member.firstName ? member.firstName[0] : member.username[0]}
                      </Avatar>
                      <Box>
                        <Typography variant="h6">
                          {member.firstName && member.lastName
                            ? `${member.firstName} ${member.lastName}`
                            : member.username}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          @{member.username}
                        </Typography>
                      </Box>
                    </Box>

                    {member.bio && (
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        {member.bio}
                      </Typography>
                    )}

                    {member.skills && member.skills.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Skills:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {member.skills.slice(0, 5).map((skill) => (
                            <Chip key={skill} label={skill} size="small" />
                          ))}
                          {member.skills.length > 5 && (
                            <Chip label={`+${member.skills.length - 5} more`} size="small" />
                          )}
                        </Box>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      {member.experience && (
                        <Chip
                          label={member.experience}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                      {member.availability && (
                        <Chip
                          label={member.availability}
                          size="small"
                          color="secondary"
                          variant="outlined"
                        />
                      )}
                    </Box>

                    {member.location && (
                      <Typography variant="body2" color="text.secondary">
                        📍 {member.location}
                      </Typography>
                    )}
                  </CardContent>

                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<Visibility />}
                      onClick={() => handleViewProfile(member)}
                    >
                      View Profile
                    </Button>
                    {member._id !== (user as UserWithId | null)?._id && (
                      <Button
                        size="small"
                        startIcon={<Message />}
                        onClick={() => handleMessageUser(member)}
                      >
                        Message
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {typedResults.length === 0 && !searchLoading && hasSearchQuery && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No members found matching your criteria
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try adjusting your search parameters
            </Typography>
          </Box>
        )}
      </Box>

      {/* Message Dialog */}
      <Dialog open={messageDialog} onClose={() => setMessageDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Send Message to{' '}
          {selectedUser?.firstName && selectedUser?.lastName
            ? `${selectedUser.firstName} ${selectedUser.lastName}`
            : selectedUser?.username}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Subject"
            value={messageData.subject}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setMessageData((prev) => ({ ...prev, subject: e.target.value }))
            }
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Message"
            multiline
            rows={4}
            value={messageData.content}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              setMessageData((prev) => ({ ...prev, content: e.target.value }))
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMessageDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSendMessage}
            variant="contained"
            disabled={
              !messageData.subject.trim() ||
              !messageData.content.trim() ||
              sendMessageMutation.isPending
            }
          >
            {sendMessageMutation.isPending ? 'Sending...' : 'Send Message'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MemberSearch;
