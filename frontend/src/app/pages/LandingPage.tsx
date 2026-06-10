import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { FileText, Target, Zap, Download, CheckCircle, Star } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useAuth } from "../contexts/AuthContext";

export default function LandingPage() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated && user) {
      if (user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, isLoading, user, navigate]);

  return (
    <div className="min-h-screen bg-white font-['Inter']">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-8 h-8 text-indigo-600" />
            <span className="text-xl font-bold text-gray-900">B2World ATS Resume Builder</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-indigo-600 hover:bg-indigo-700">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
          Build ATS-Friendly Resumes.<br />Get Hired Faster.
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Create professional resumes that pass Applicant Tracking Systems with our AI-powered builder. 
          Get real-time ATS scores, optimize for job descriptions, and download instantly.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link to="/auth">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-lg px-8 py-6">
              Create Resume
            </Button>
          </Link>
          <Link to="/auth">
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-indigo-600 text-indigo-600 hover:bg-indigo-50">
              Check ATS Score
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-12 mt-16 flex-wrap">
          <div>
            <div className="text-4xl font-bold text-indigo-600">50K+</div>
            <div className="text-gray-600 mt-1">Resumes Created</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-indigo-600">95%</div>
            <div className="text-gray-600 mt-1">ATS Pass Rate</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-indigo-600">4.9/5</div>
            <div className="text-gray-600 mt-1">User Rating</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">
            Why Choose B2World Resume Builder?
          </h2>
          <p className="text-center text-gray-600 mb-12 text-lg">
            Everything you need to create a resume that gets you interviews
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border border-gray-200 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                  <Target className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  ATS Score out of 100
                </h3>
                <p className="text-gray-600">
                  Get instant feedback on how well your resume will perform with ATS systems. See your score and improve it.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  JD-Based Auto Generator
                </h3>
                <p className="text-gray-600">
                  Paste any job description and our AI will generate or optimize your resume to match perfectly.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-yellow-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  One-Click Resume Fixes
                </h3>
                <p className="text-gray-600">
                  Apply AI-suggested improvements with a single click. Fix formatting, keywords, and action verbs instantly.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Download className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Instant PDF Download
                </h3>
                <p className="text-gray-600">
                  Download your resume as PDF or DOCX instantly. No waiting, no watermarks, no hidden fees.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
            What Our Users Say
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4">
                  "I got 3 interview calls in just one week after using B2World Resume Builder. The ATS score feature is a game-changer!"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                    <span className="text-indigo-600 font-semibold">SP</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Sarah Patel</div>
                    <div className="text-sm text-gray-600">Software Engineer</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4">
                  "The JD-based optimization is incredible. It tailored my resume perfectly to each job I applied for. Highly recommend!"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 font-semibold">MJ</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Michael Johnson</div>
                    <div className="text-sm text-gray-600">Data Analyst</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4">
                  "Simple, clean, and effective. My ATS score went from 62 to 94 after applying the suggested fixes. Got hired at my dream company!"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 font-semibold">EW</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Emily Wang</div>
                    <div className="text-sm text-gray-600">Product Manager</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-indigo-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Build Your Perfect Resume?
          </h2>
          <p className="text-xl text-indigo-100 mb-8">
            Join thousands of job seekers who landed their dream jobs with B2World
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-white text-indigo-600 hover:bg-gray-100 text-lg px-8 py-6">
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-6 h-6 text-indigo-400" />
                <span className="text-white font-semibold">B2World</span>
              </div>
              <p className="text-sm">
                Build ATS-friendly resumes that get you hired faster.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Templates</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">ATS Score</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">Resume Tips</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">About Us</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            <p>© 2026 B2World ATS Resume Builder. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
