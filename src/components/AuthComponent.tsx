import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import ChatComponent from './chat/ChatComponent';
import '../styles/Auth.css';

const AuthComponent = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isRegister, setIsRegister] = useState(false);
    const [resetPassword, setResetPassword] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
        } catch (error: any) {
            setError(error.message || 'An error occurred during login');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) throw error;

            setSuccessMessage('Registration successful! Please check your email to confirm your account.');
        } catch (error: any) {
            setError(error.message || 'An error occurred during registration');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin,
            });

            if (error) throw error;

            setSuccessMessage('Password reset email sent! Please check your inbox.');
        } catch (error: any) {
            setError(error.message || 'An error occurred when sending the password reset email');
        } finally {
            setLoading(false);
        }
    };

    const renderForm = () => {
        if (resetPassword) {
            return (
                <form onSubmit={handleResetPassword} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="Enter your email address"
                        />
                    </div>

                    <button type="submit" className="submit-button" disabled={loading}>
                        {loading ? 'Sending...' : 'Send Recovery Link'}
                    </button>

                    <div className="form-footer">
                        <button
                            type="button"
                            className="text-button"
                            onClick={() => {
                                setResetPassword(false);
                                setError(null);
                                setSuccessMessage(null);
                            }}
                        >
                            Back to login
                        </button>
                    </div>
                </form>
            );
        }

        return (
            <form onSubmit={isRegister ? handleRegister : handleLogin} className="auth-form">
                <div className="form-group">
                    <label htmlFor="email">Email Address</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="Enter your email address"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder={isRegister ? "Create a password" : "Enter your password"}
                        minLength={6}
                    />
                    {isRegister && (
                        <p className="password-hint">Password must be at least 6 characters long</p>
                    )}
                </div>

                <button type="submit" className="submit-button" disabled={loading}>
                    {loading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}
                </button>

                <div className="form-footer">
                    {!isRegister && (
                        <button
                            type="button"
                            className="text-button"
                            onClick={() => {
                                setResetPassword(true);
                                setError(null);
                                setSuccessMessage(null);
                            }}
                        >
                            Forgot your password?
                        </button>
                    )}

                    <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                            setIsRegister(!isRegister);
                            setError(null);
                            setSuccessMessage(null);
                        }}
                    >
                        {isRegister ? 'Already have an account? Sign in' : 'New to Chatterbox? Create account'}
                    </button>
                </div>
            </form>
        );
    };

    if (!session) {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-header">
                        <div className="auth-logo">
                            <img src="/images/chatterbox-logo.svg" alt="Chatterbox Logo" />
                        </div>
                        <h1>Chatterbox</h1>
                        <p>{isRegister ? 'Create your account to get started' : resetPassword ? 'Reset your password' : 'Welcome back to Chatterbox'}</p>
                    </div>

                    {error && <div className="error-message">{error}</div>}
                    {successMessage && <div className="success-message">{successMessage}</div>}

                    {renderForm()}
                </div>
            </div>
        );
    }

    return <ChatComponent session={session} />;
};

export default AuthComponent;