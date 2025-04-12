import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';
import './Chat.css';

interface ChatComponentProps {
    session: Session;
}

export interface Profile {
    id: string;
    username: string;
    avatar_url: string | null;
    created_at: string;
}

export interface Conversation {
    id: string;
    created_at: string;
    updated_at: string;
    last_message: string | null;
    last_message_time: string | null;
}

export interface ConversationParticipant {
    conversation_id: string;
    profile_id: string;
    profile: Profile;
}

export interface Message {
    id: string;
    conversation_id: string;
    profile_id: string;
    content: string;
    created_at: string;
    profile: Profile;
    is_received: boolean;
    received_at: string | null;
    is_delivered: boolean;
    delivered_at: string | null;
    is_read: boolean;
    read_at: string | null;
}

const ChatComponent = ({ session }: ChatComponentProps) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [activeConversation, setActiveConversation] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
    const accountMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (session) {
            setCurrentUser(session.user);
            ensureProfile(session.user);
        }
    }, [session]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
                setIsAccountMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const ensureProfile = async (user: User) => {
        try {
            console.log('Ensuring profile exists for user:', user.id);
            
            const { data: existingProfile, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error('Error checking for existing profile:', fetchError);
                setLoading(false);
                return;
            }

            if (existingProfile) {
                console.log('Profile already exists:', existingProfile);
                setProfile(existingProfile);
                setLoading(false);
                return;
            }

            console.log('No profile found, creating profile');
            
            const email = user.email || '';
            const username = email.split('@')[0] || 'user';
            
            console.log('Using username:', username);
            
            const newProfile = {
                id: user.id,
                username,
                avatar_url: null,
                created_at: new Date().toISOString(),
            };
            
            const { data: createdProfile, error: insertError } = await supabase
                .from('profiles')
                .insert([newProfile])
                .select()
                .single();

            if (insertError) {
                console.error('Error creating profile:', insertError);
                
                if (insertError.code === '42501') {
                    console.warn('RLS policy error. Make sure your Supabase policies are configured correctly.');
                    setProfile(newProfile as Profile);
                }
            } else if (createdProfile) {
                console.log('Profile created successfully:', createdProfile);
                setProfile(createdProfile);
            }
        } catch (error) {
            console.error('Error in ensureProfile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    if (loading) {
        return (
            <div className="chat-loading">
                <div className="loading-spinner"></div>
                <p>Loading chat...</p>
            </div>
        );
    }

    return (
        <div className="chat-container">
            <div className="chat-header">
                <div className="chat-brand">
                    <img src="/images/chatterbox-logo.svg" alt="Chatterbox Logo" className="chat-logo" />
                    <h2>Chatterbox</h2>
                </div>
                
                <div className="account-menu-container" ref={accountMenuRef}>
                    <button 
                        className="account-button" 
                        onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
                    >
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt={profile?.username} className="account-avatar" />
                        ) : (
                            <div className="account-avatar-placeholder">
                                {profile?.username.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="account-username">{profile?.username}</span>
                        <span className="dropdown-icon">▼</span>
                    </button>
                    
                    {isAccountMenuOpen && (
                        <div className="account-dropdown">
                            <div className="account-info">
                                <p className="account-email">{currentUser?.email}</p>
                            </div>
                            <div className="dropdown-divider"></div>
                            <button className="dropdown-item" onClick={handleSignOut}>
                                Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="chat-main">
                <ConversationList
                    userId={currentUser?.id || ''}
                    activeConversation={activeConversation}
                    setActiveConversation={setActiveConversation}
                />

                {activeConversation ? (
                    <ChatWindow
                        conversationId={activeConversation}
                        userId={currentUser?.id || ''}
                        profile={profile}
                    />
                ) : (
                    <div className="no-conversation-selected">
                        <p>Select a conversation or start a new one</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatComponent;