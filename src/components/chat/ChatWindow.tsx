import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Message, Profile } from './ChatComponent';

interface ChatWindowProps {
  conversationId: string;
  userId: string;
  profile: Profile | null;
}

const ChatWindow = ({ conversationId, userId, profile }: ChatWindowProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [isTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const notificationSound = useRef<HTMLAudioElement | null>(null);
  const windowFocused = useRef<boolean>(document.hasFocus());
  const [visibleMessages, setVisibleMessages] = useState<Set<string>>(new Set());
  const messageObserver = useRef<IntersectionObserver | null>(null);
  const messageRefs = useRef<{[key: string]: HTMLDivElement | null}>({});

  useEffect(() => {
    notificationSound.current = new Audio('/sounds/notification.mp3');
    
    const handleFocus = () => { windowFocused.current = true; };
    const handleBlur = () => { windowFocused.current = false; };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    if (messageObserver.current) {
      messageObserver.current.disconnect();
    }

    messageObserver.current = new IntersectionObserver(
      (entries) => {
        const newVisibleMessages = new Set(visibleMessages);
        let hasChanges = false;

        entries.forEach(entry => {
          const messageId = entry.target.getAttribute('data-message-id');
          if (messageId && entry.isIntersecting) {
            if (!newVisibleMessages.has(messageId)) {
              newVisibleMessages.add(messageId);
              hasChanges = true;
            }
          }
        });

        if (hasChanges) {
          setVisibleMessages(newVisibleMessages);
        }
      },
      { threshold: 0.5 }
    );

    Object.entries(messageRefs.current).forEach(([messageId, ref]) => {
      if (ref) {
        console.log(messageId);
        messageObserver.current?.observe(ref);
      }
    });

    return () => {
      messageObserver.current?.disconnect();
    };
  }, [messages, visibleMessages]);

  useEffect(() => {
    if (visibleMessages.size > 0 && windowFocused.current) {
      const unreadMessages = messages.filter(msg => 
        msg.profile_id !== userId && 
        !msg.is_read && 
        visibleMessages.has(msg.id) 
      );
      
      if (unreadMessages.length > 0) {
        markMessagesAsRead(unreadMessages);
      }
    }
  }, [visibleMessages, messages, userId, windowFocused.current]);

  useEffect(() => {
    if (conversationId) {
      fetchMessages();
      fetchOtherParticipant();
      
      const messagesSubscription = supabase
        .channel(`messages:${conversationId}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        }, (payload) => {
          const newMessage = payload.new as Message;
          
          if (newMessage.profile_id !== userId) {
            if (notificationSound.current) {
              notificationSound.current.play().catch(err => {
                console.log('Error playing notification sound:', err);
              });
            }
            
            markMessageAsReceived(newMessage.id);
            
            if (windowFocused.current) {
              markMessageAsDelivered(newMessage.id);
            }
            
            fetchMessages();
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        }, () => {
          fetchMessages();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(messagesSubscription);
      };
    }
  }, [conversationId, userId]);

  useEffect(() => {
    const handleFocus = () => {
      windowFocused.current = true;
      
      const undeliveredMessages = messages.filter(msg => 
        msg.profile_id !== userId && 
        !msg.is_delivered 
      );
      
      if (undeliveredMessages.length > 0) {
        undeliveredMessages.forEach(msg => {
          markMessageAsDelivered(msg.id);
        });
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [messages, userId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profile:profiles(*)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      const typedMessages = data as unknown as Message[];
      setMessages(typedMessages);
      
      if (windowFocused.current) {
        const receivedButNotDelivered = typedMessages.filter(msg => 
          msg.profile_id !== userId && 
          msg.is_received && 
          !msg.is_delivered 
        );
        
        if (receivedButNotDelivered.length > 0) {
          receivedButNotDelivered.forEach(msg => {
            markMessageAsDelivered(msg.id);
          });
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOtherParticipant = async () => {
    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select(`
          profile:profiles(*)
        `)
        .eq('conversation_id', conversationId)
        .neq('profile_id', userId)
        .single();

      if (error) {
        throw error;
      }

      setOtherUser(data.profile as unknown as Profile);
    } catch (error) {
      console.error('Error fetching other participant:', error);
    }
  };

  const markMessageAsReceived = async (messageId: string) => {
    try {
      const now = new Date().toISOString();
      
      await supabase
        .from('messages')
        .update({
          is_received: true,
          received_at: now
        })
        .eq('id', messageId)
        .eq('is_received', false);
    } catch (error) {
      console.error('Error marking message as received:', error);
    }
  };

  const markMessageAsDelivered = async (messageId: string) => {
    try {
      const now = new Date().toISOString();
      
      await supabase
        .from('messages')
        .update({
          is_delivered: true,
          delivered_at: now
        })
        .eq('id', messageId)
        .eq('is_delivered', false);
    } catch (error) {
      console.error('Error marking message as delivered:', error);
    }
  };

  const markMessagesAsRead = async (messagesToMark: Message[]) => {
    try {
      const now = new Date().toISOString();
      const messageIds = messagesToMark.map(msg => msg.id);
      
      await supabase
        .from('messages')
        .update({
          is_read: true,
          read_at: now
        })
        .in('id', messageIds)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !profile) return;
    
    try {
      const messageToSend = {
        conversation_id: conversationId,
        profile_id: userId,
        content: newMessage.trim(),
        created_at: new Date().toISOString(),
        is_received: false,
        received_at: null,
        is_delivered: false,
        delivered_at: null,
        is_read: false,
        read_at: null
      };

      const optimisticMessage: Message = {
        ...messageToSend,
        id: `temp-${Date.now()}`,
        profile: profile
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
      setNewMessage('');

      const { error } = await supabase
        .from('messages')
        .insert([messageToSend]);

      if (error) {
        throw error;
      }

      await supabase
        .from('conversations')
        .update({
          last_message: newMessage.trim(),
          last_message_time: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(msg => msg.id !== `temp-${Date.now()}`));
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatMessageDate = (timestamp: string, index: number) => {
    const date = new Date(timestamp);
    const formattedDate = date.toLocaleDateString([], { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });

    if (index === 0) {
      return formattedDate;
    }

    const prevDate = new Date(messages[index - 1].created_at);
    if (prevDate.toDateString() !== date.toDateString()) {
      return formattedDate;
    }

    return null;
  };

  const isConsecutiveMessage = (message: Message, index: number) => {
    if (index === 0) return false;
    
    const prevMessage = messages[index - 1];
    return prevMessage.profile_id === message.profile_id && 
           message.profile_id === userId &&
           new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() < 5 * 60 * 1000;
  };

  const getMessageStatusIcon = (message: Message) => {
    if (!message.id.startsWith('temp-')) {
      if (message.is_read) {
        return <span className="message-status read" title="Read">✓✓</span>;
      } else if (message.is_delivered) {
        return <span className="message-status delivered" title="Delivered">✓✓</span>;
      } else if (message.is_received) {
        return <span className="message-status received" title="Received">✓</span>;
      } else {
        return <span className="message-status pending" title="Sending">⏱</span>;
      }
    }
    return <span className="message-status pending" title="Sending">⏱</span>;
  };

  const setMessageRef = useCallback((messageId: string, element: HTMLDivElement | null) => {
    messageRefs.current[messageId] = element;
  }, []);

  if (!conversationId) {
    return (
      <div className="no-conversation-selected">
        <p>Please select a conversation to start chatting</p>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <div className="chat-window-header">
        {otherUser && (
          <>
            <div className="chat-window-avatar">
              {otherUser.avatar_url ? (
                <img src={otherUser.avatar_url} alt={otherUser.username} />
              ) : (
                <div className="avatar-placeholder">
                  {otherUser.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="chat-window-user-info">
              <div className="chat-window-username">{otherUser.username}</div>
              {isTyping && <div className="typing-indicator">typing...</div>}
            </div>
          </>
        )}
      </div>

      <div className="messages-container">
        {loading ? (
          <div className="loading-messages">
            <p>Loading messages...</p>
          </div>
        ) : (
          <div className="messages">
            {messages.length === 0 ? (
              <div className="no-messages">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((message, index) => {
                const isCurrentUser = message.profile_id === userId;
                const dateHeader = formatMessageDate(message.created_at, index);
                const consecutive = isConsecutiveMessage(message, index);

                return (
                  <div key={message.id}>
                    {dateHeader && (
                      <div className="message-date-header">
                        <span>{dateHeader}</span>
                      </div>
                    )}
                    <div 
                      ref={(el) => setMessageRef(message.id, el)}
                      data-message-id={message.id}
                      className={`message ${isCurrentUser ? 'sent' : 'received'} ${consecutive ? 'consecutive' : ''}`}
                    >
                      {!isCurrentUser && !consecutive && (
                        <div className="message-avatar">
                          {message.profile.avatar_url ? (
                            <img src={message.profile.avatar_url} alt={message.profile.username} />
                          ) : (
                            <div className="avatar-placeholder-small">
                              {message.profile.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="message-content">
                        {!consecutive && !isCurrentUser && (
                          <div className="message-sender">{message.profile.username}</div>
                        )}
                        <div className="message-bubble">
                          <div className="message-text">{message.content}</div>
                          <div className="message-info">
                            <span className="message-time">{formatMessageTime(message.created_at)}</span>
                            {isCurrentUser && getMessageStatusIcon(message)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form className="message-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="message-input"
        />
        <button 
          type="submit" 
          className="send-button"
          disabled={!newMessage.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatWindow;