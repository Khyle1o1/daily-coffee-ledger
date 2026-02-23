import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coffee, Mail, Lock, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/auth/useAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp, resetPassword, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // If user is already logged in, redirect to app
  useEffect(() => {
    if (user) {
      navigate('/app/daily', { replace: true });
    }
  }, [user, navigate]);

  const validateEmail = (email: string) => {
    return email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      toast({
        variant: 'destructive',
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Invalid password',
        description: 'Password must be at least 6 characters long.',
      });
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Sign in failed',
        description: error.message || 'Invalid email or password.',
      });
    } else {
      toast({
        title: 'Welcome back!',
        description: 'You have successfully signed in.',
      });
      navigate('/app/daily');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      toast({
        variant: 'destructive',
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Password too short',
        description: 'Password must be at least 6 characters long.',
      });
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Sign up failed',
        description: error.message || 'Could not create account.',
      });
    } else {
      toast({
        title: 'Account created!',
        description: 'Check your email to confirm your account, then sign in.',
      });
      setEmail('');
      setPassword('');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(resetEmail)) {
      toast({
        variant: 'destructive',
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
      });
      return;
    }

    setLoading(true);
    const { error } = await resetPassword(resetEmail);
    setLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Reset failed',
        description: error.message || 'Could not send reset email.',
      });
    } else {
      toast({
        title: 'Reset email sent!',
        description: 'Check your inbox for the password reset link.',
      });
      setShowResetForm(false);
      setResetEmail('');
    }
  };

  if (showResetForm) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Back to Login */}
          <Button
            variant="ghost"
            className="text-primary-foreground hover:bg-primary-foreground/10 mb-4"
            onClick={() => setShowResetForm(false)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to login
          </Button>

          {/* Reset Form Card */}
          <div className="bg-card rounded-3xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="bg-primary/10 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Coffee className="h-8 w-8 text-primary" strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-bold text-card-foreground mb-2">Reset Password</h2>
              <p className="text-muted-foreground">Enter your email to receive a reset link</p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-card-foreground font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="your@email.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="pl-10 rounded-xl h-11"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full rounded-xl h-11 bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Back to Landing */}
        <Button
          variant="ghost"
          className="text-primary-foreground hover:bg-primary-foreground/10 mb-4"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to landing
        </Button>

        {/* Login Card */}
        <div className="bg-card rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="bg-primary/10 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Coffee className="h-8 w-8 text-primary" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-bold text-card-foreground mb-2">Welcome back</h2>
            <p className="text-muted-foreground">Sign in to your DOT Coffee account</p>
          </div>

          {/* Sign In Form (No Signup Tab) */}
          <div className="w-full">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="text-card-foreground font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 rounded-xl h-11"
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signin-password" className="text-card-foreground font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 rounded-xl h-11"
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full rounded-xl h-11 bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline font-medium"
                    onClick={() => setShowResetForm(true)}
                  >
                    Forgot password?
                  </button>
                </div>
              </form>
              
              <div className="mt-6 p-4 bg-muted/50 rounded-xl">
                <p className="text-sm text-muted-foreground text-center">
                  <strong>Note:</strong> User accounts can only be created by administrators.
                  Contact your admin if you need access.
                </p>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
