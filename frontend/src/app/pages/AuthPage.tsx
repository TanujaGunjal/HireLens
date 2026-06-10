import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { FileText, AlertCircle, Loader } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../contexts/AuthContext";
import { authAPI } from "../services/api";
import { toast } from "sonner";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user, login, register, isAuthenticated, isLoading } = useAuth();

  // Redirect if already authenticated (based on role)
  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated && user) {
      // If user is admin, redirect to admin dashboard
      if (user.role === 'ADMIN') {
        navigate("/admin");
      } else {
        // Regular users go to dashboard
        navigate("/dashboard");
      }
    }
  }, [isAuthenticated, isLoading, user, navigate]);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Trim whitespace from inputs
      const email = formData.email.trim();
      const password = formData.password.trim();
      const name = formData.name.trim();

      let userData;
      if (isLogin) {
        await login(email, password);
        toast.success("Login successful!");
        userData = authAPI.getCurrentUser();
      } else {
        if (!name) {
          toast.error("Please enter your name");
          setIsSubmitting(false);
          return;
        }
        await register(name, email, password);
        toast.success("Account created successfully!");
        userData = authAPI.getCurrentUser();
      }
      
      // Redirect based on user role
      if (userData?.role === 'ADMIN') {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 font-['Inter']">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-2">
            <FileText className="w-8 h-8 text-indigo-600" />
            <span className="text-2xl font-bold text-gray-900">B2World</span>
          </Link>
          <p className="text-gray-600">ATS Resume Builder</p>
        </div>

        <Card className="border border-gray-200 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {isLogin ? "Welcome Back" : "Create Account"}
            </CardTitle>
            <CardDescription>
              {isLogin 
                ? "Sign in to continue building your resume" 
                : "Get started with your free account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name" 
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={handleInputChange}
                    required 
                    disabled={isSubmitting}
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email" 
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  required 
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password" 
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange}
                  required 
                  disabled={isSubmitting}
                  minLength={6}
                />
                {!isLogin && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    Password must include: uppercase, lowercase, and a number
                  </p>
                )}
              </div>

              {isLogin && (
                <div className="flex items-center justify-between text-sm">
                  <label htmlFor="remember-me" className="flex items-center gap-2">
                    <input id="remember-me" name="remember-me" type="checkbox" className="rounded" disabled={isSubmitting} />
                    <span className="text-gray-600">Remember me</span>
                  </label>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    {isLogin ? "Signing In..." : "Creating Account..."}
                  </>
                ) : (
                  isLogin ? "Sign In" : "Create Account"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-gray-600">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
              </span>
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setFormData({ name: "", email: "", password: "" });
                }}
                className="text-indigo-600 font-semibold hover:underline disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </div>

            {!isLogin && (
              <p className="mt-4 text-xs text-center text-gray-500">
                By signing up, you agree to our Terms of Service and Privacy Policy
              </p>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}