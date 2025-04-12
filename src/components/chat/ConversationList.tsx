import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Conversation, ConversationParticipant, Profile } from './ChatComponent';

interface ConversationListProps {
    userId: string;
    activeConversation: string | null;
    setActiveConversation: (id: string) => void;
}

const ConversationList = ({ userId, activeConversation, setActiveConversation }: ConversationListProps) => {
    const [conversations, setConversations] = useState<Array<{
        conversation: Conversation;
        participants: ConversationParticipant[];
    }>>([]);
    const [loading, setLoading] = useState(true);
    const [newChatModalOpen, setNewChatModalOpen] = useState(false);
    const [conversationSearchTerm, setConversationSearchTerm] = useState('');
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const [loadingUsers, setLoadingUsers] = useState(false);

    useEffect(() => {
        fetchConversations();

        const conversationsSubscription = supabase
            .channel('public:conversations')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'conversations'
            }, () => {
                fetchConversations();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(conversationsSubscription);
        };
    }, [userId]);

    const fetchConversations = async () => {
        try {
            console.log('Fetching conversations for user:', userId);
            
            const { data: participantData, error: participantError } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('profile_id', userId);

            if (participantError) {
                console.error('Error fetching conversation participants:', participantError);
                setLoading(false);
                return;
            }

            if (!participantData || participantData.length === 0) {
                console.log('No conversations found for user');
                setConversations([]);
                setLoading(false);
                return;
            }

            console.log('Found conversation IDs:', participantData);
            const conversationIds = participantData.map(item => item.conversation_id);

            const { data: conversationsData, error: conversationsError } = await supabase
                .from('conversations')
                .select('*')
                .in('id', conversationIds)
                .order('updated_at', { ascending: false });

            if (conversationsError) {
                console.error('Error fetching conversations:', conversationsError);
                setLoading(false);
                return;
            }

            if (!conversationsData || conversationsData.length === 0) {
                console.log('No conversation details found');
                setConversations([]);
                setLoading(false);
                return;
            }

            console.log('Found conversations:', conversationsData);

            const conversationsWithParticipants = await Promise.all(
                conversationsData.map(async (conversation) => {
                    try {
                        const { data: participants, error: participantsError } = await supabase
                            .from('conversation_participants')
                            .select(`
                conversation_id,
                profile_id,
                profile:profiles(*)
              `)
                            .eq('conversation_id', conversation.id);

                        if (participantsError) {
                            console.error('Error fetching participants for conversation:', conversation.id, participantsError);
                            return {
                                conversation,
                                participants: []
                            };
                        }

                        return {
                            conversation,
                            participants: participants as unknown as ConversationParticipant[]
                        };
                    } catch (err) {
                        console.error('Error in participants query for conversation:', conversation.id, err);
                        return {
                            conversation,
                            participants: []
                        };
                    }
                })
            );

            setConversations(conversationsWithParticipants);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableUsers = async () => {
        try {
            setLoadingUsers(true);
            console.log('Fetching available users...');
            
            const { data: authUsers, error: authError } = await supabase
                .from('auth.users')
                .select('id, email')
                .neq('id', userId);
            
            if (authError) {
                console.error('Error fetching auth users:', authError);
                
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .neq('id', userId);

                if (error) {
                    throw error;
                }
                
                console.log('Available users from profiles:', data);
                setAvailableUsers(data || []);
                return;
            }
            
            console.log('Auth users:', authUsers);
            
            if (authUsers && authUsers.length > 0) {
                const usersWithProfiles = await Promise.all(
                    authUsers.map(async (user) => {
                        const { data: profile, error } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('id', user.id)
                            .single();
                            
                        if (error && error.code === 'PGRST116') {
                            const email = user.email || '';
                            const username = email.split('@')[0];
                            
                            const { data: newProfile, error: insertError } = await supabase
                                .from('profiles')
                                .insert([
                                    {
                                        id: user.id,
                                        username,
                                        avatar_url: null,
                                        created_at: new Date().toISOString(),
                                    },
                                ])
                                .select()
                                .single();
                                
                            if (insertError) {
                                console.error('Error creating profile for user:', user.id, insertError);
                                return null;
                            }
                            
                            return newProfile;
                        }
                        
                        return profile;
                    })
                );
                
                const validProfiles = usersWithProfiles.filter(profile => profile !== null) as Profile[];
                console.log('Users with profiles:', validProfiles);
                setAvailableUsers(validProfiles);
            } else {
                setAvailableUsers([]);
            }
        } catch (error) {
            console.error('Error fetching available users:', error);
        } finally {
            setLoadingUsers(false);
        }
    };

    const createNewConversation = async () => {
        if (!selectedUser) return;

        try {
            const { data: conversationData, error: conversationError } = await supabase
                .from('conversations')
                .insert([
                    {
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ])
                .select()
                .single();

            if (conversationError) throw conversationError;

            console.log('Created conversation:', conversationData);

            const { error: participantsError } = await supabase
                .from('conversation_participants')
                .insert([
                    { conversation_id: conversationData.id, profile_id: userId },
                    { conversation_id: conversationData.id, profile_id: selectedUser.id }
                ]);

            if (participantsError) throw participantsError;

            setActiveConversation(conversationData.id);
            setNewChatModalOpen(false);
            setSelectedUser(null);
            setUserSearchTerm('');
            fetchConversations();
        } catch (error) {
            console.error('Error creating conversation:', error);
        }
    };

    const getOtherParticipant = (participants: ConversationParticipant[]) => {
        const otherParticipant = participants.find(p => p.profile_id !== userId);
        return otherParticipant ? otherParticipant.profile : null;
    };

    const formatTime = (timestamp: string | null) => {
        if (!timestamp) return '';

        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        if (isToday) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const handleNewChat = () => {
        setNewChatModalOpen(true);
        setUserSearchTerm('');
        setSelectedUser(null);
        fetchAvailableUsers();
    };

    return (
        <div className="conversation-list">
            <div className="conversation-list-header">
                <div className="header-top-row">
                    <div className="chats-header-title">
                        <h3>Chats</h3>
                    </div>
                    <button
                        className="new-chat-icon-button"
                        onClick={handleNewChat}
                        title="New chat"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z" fill="currentColor" />
                        </svg>
                    </button>
                </div>
                <div className="search-input-container">
                    <span className="search-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15.5 14H14.71L14.43 13.73C15.41 12.59 16 11.11 16 9.5C16 5.91 13.09 3 9.5 3C5.91 3 3 5.91 3 9.5C3 13.09 5.91 16 9.5 16C11.11 16 12.59 15.41 13.73 14.43L14 14.71V15.5L19 20.49L20.49 19L15.5 14ZM9.5 14C7.01 14 5 11.99 5 9.5C5 7.01 7.01 5 9.5 5C11.99 5 14 7.01 14 9.5C14 11.99 11.99 14 9.5 14Z" fill="#888" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        placeholder="Search conversations..."
                        value={conversationSearchTerm}
                        onChange={(e) => setConversationSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            {loading ? (
                <div className="loading-conversations">
                    <p>Loading conversations...</p>
                </div>
            ) : (
                <div className="conversations">
                    {conversations.length === 0 ? (
                        <div className="no-conversations">
                            <p>No conversations yet</p>
                            <p className="start-chat-hint">Tap on the + icon to start a conversation</p>
                        </div>
                    ) : (
                        conversations
                            .filter(({ participants }) => {
                                if (!conversationSearchTerm) return true;
                                const otherParticipant = getOtherParticipant(participants);
                                return otherParticipant?.username.toLowerCase().includes(conversationSearchTerm.toLowerCase());
                            })
                            .map(({ conversation, participants }) => {
                                const otherParticipant = getOtherParticipant(participants);

                                return (
                                    <div
                                        key={conversation.id}
                                        className={`conversation-item ${activeConversation === conversation.id ? 'active' : ''}`}
                                        onClick={() => setActiveConversation(conversation.id)}
                                    >
                                        <div className="conversation-avatar">
                                            {otherParticipant?.avatar_url ? (
                                                <img src={otherParticipant.avatar_url} alt={otherParticipant.username} />
                                            ) : (
                                                <div className="avatar-placeholder">
                                                    {otherParticipant?.username.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="conversation-details">
                                            <div className="conversation-name">{otherParticipant?.username}</div>
                                            <div className="conversation-last-message">{conversation.last_message || 'No messages yet'}</div>
                                        </div>
                                        <div className="conversation-time">
                                            {formatTime(conversation.last_message_time)}
                                        </div>
                                    </div>
                                );
                            })
                    )}
                </div>
            )}

            {newChatModalOpen && (
                <div className="modal-overlay">
                    <div className="new-chat-modal">
                        <div className="modal-header">
                            <h3>New Conversation</h3>
                            <button
                                className="close-modal-button"
                                onClick={() => {
                                    setNewChatModalOpen(false);
                                    setSelectedUser(null);
                                }}
                            >
                                &times;
                            </button>
                        </div>

                        <div className="modal-body">
                            <input
                                type="text"
                                placeholder="Search users..."
                                className="search-user-input"
                                value={userSearchTerm}
                                onChange={(e) => setUserSearchTerm(e.target.value)}
                            />

                            <div className="user-list">
                                {loadingUsers ? (
                                    <div className="loading-users">
                                        <p>Loading users...</p>
                                    </div>
                                ) : availableUsers.length === 0 ? (
                                    <div className="no-users-found">
                                        <p>No users found. Make sure to create multiple accounts to chat with.</p>
                                    </div>
                                ) : (
                                    availableUsers
                                        .filter(user =>
                                            !userSearchTerm ||
                                            user.username.toLowerCase().includes(userSearchTerm.toLowerCase())
                                        )
                                        .map(user => (
                                            <div
                                                key={user.id}
                                                className={`user-item ${selectedUser?.id === user.id ? 'selected' : ''}`}
                                                onClick={() => setSelectedUser(user)}
                                            >
                                                <div className="user-avatar">
                                                    {user.avatar_url ? (
                                                        <img src={user.avatar_url} alt={user.username} />
                                                    ) : (
                                                        <div className="avatar-placeholder">
                                                            {user.username.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="user-name">{user.username}</div>
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="cancel-button"
                                onClick={() => {
                                    setNewChatModalOpen(false);
                                    setSelectedUser(null);
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="start-chat-button"
                                disabled={!selectedUser}
                                onClick={createNewConversation}
                            >
                                Start Chat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConversationList;