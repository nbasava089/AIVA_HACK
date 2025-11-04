import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Link2, FileText, AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

interface VerificationResult {
  id: string;
  is_fake: boolean;
  confidence_score: number;
  detected_issues: string[];
  analysis_result: {
    analysis_summary: string;
    recommendations: string;
  };
  created_at: string;
}

const FakeBuster = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [textContent, setTextContent] = useState("");
  const [urlContent, setUrlContent] = useState("");
  const { toast } = useToast();

  const verifyContent = async (contentType: string, contentUrl?: string, contentText?: string) => {
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('verify-content', {
        body: { contentType, contentUrl, contentText }
      });

      if (error) throw error;

      if (data.success) {
        setResult(data.result);
        toast({
          title: "Analysis Complete",
          description: "Content has been verified successfully",
        });
      } else {
        throw new Error(data.error || 'Verification failed');
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify content",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      await verifyContent('image', base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="container mx-auto p-6 space-y-8 max-w-6xl">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border border-blue-100 p-8">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-500/10 to-cyan-500/10 rounded-full blur-xl"></div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <ShieldAlert className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              FakeBuster
            </h1>
          </div>
          <p className="text-gray-600 text-lg leading-relaxed max-w-2xl">
            Advanced AI-powered verification system for detecting deepfakes, misinformation, and manipulated content across images, text, and URLs.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">Deepfake Detection</Badge>
            <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200">Content Analysis</Badge>
            <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200">Real-time Verification</Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="image" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12 bg-gray-50 border border-gray-200 p-1 rounded-xl">
          <TabsTrigger value="image" className="rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200">Image Analysis</TabsTrigger>
          <TabsTrigger value="text" className="rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200">Text Verification</TabsTrigger>
          <TabsTrigger value="url" className="rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200">URL Check</TabsTrigger>
        </TabsList>

        <TabsContent value="image" className="space-y-6 mt-8">
          <Card className="relative overflow-hidden border-0 bg-white/80 backdrop-blur-sm shadow-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-600"></div>
            <CardHeader className="pb-6">
              <CardTitle className="flex items-center gap-3 text-xl text-gray-800">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
                  <Upload className="h-5 w-5 text-white" />
                </div>
                Image Deepfake Detection
              </CardTitle>
              <CardDescription className="text-base text-gray-600 leading-relaxed">
                Upload an image to detect deepfakes, AI-generated content, violence, or protests using advanced computer vision algorithms
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Upload Image File
                </label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={loading}
                  className="cursor-pointer h-12 border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-500">Supported formats: JPG, PNG, WEBP, GIF (Max size: 10MB)</p>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500 font-medium">OR</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Paste Image URL
                </label>
                <div className="flex gap-3">
                  <Input
                    placeholder="https://example.com/image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    disabled={loading}
                    className="flex-1 h-12 focus:border-blue-500 focus:ring-blue-200 transition-all duration-200"
                  />
                  <Button
                    onClick={() => verifyContent('image', imageUrl)}
                    disabled={loading || !imageUrl}
                    className="h-12 px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Analyze Image"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="text" className="space-y-6 mt-8">
          <Card className="relative overflow-hidden border-0 bg-white/80 backdrop-blur-sm shadow-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-600"></div>
            <CardHeader className="pb-6">
              <CardTitle className="flex items-center gap-3 text-xl text-gray-800">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                Text Fact-Checking & Analysis
              </CardTitle>
              <CardDescription className="text-base text-gray-600 leading-relaxed">
                Verify news articles, social media posts, claims, or any text content for misinformation and bias detection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Text Content to Verify
                </label>
                <Textarea
                  placeholder="Paste news article, tweet, claim, or any text content you want to verify for accuracy and potential misinformation..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  disabled={loading}
                  rows={8}
                  className="resize-none border-2 border-gray-200 focus:border-green-500 focus:ring-green-200 transition-all duration-200 text-sm leading-relaxed"
                />
                <p className="text-xs text-gray-500">Maximum 5,000 characters for optimal analysis</p>
              </div>
              <Button
                onClick={() => verifyContent('text', undefined, textContent)}
                disabled={loading || !textContent.trim()}
                className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 text-sm font-medium"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Analyzing Text...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Verify Text Content</span>
                  </div>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="url" className="space-y-6 mt-8">
          <Card className="relative overflow-hidden border-0 bg-white/80 backdrop-blur-sm shadow-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-600"></div>
            <CardHeader className="pb-6">
              <CardTitle className="flex items-center gap-3 text-xl text-gray-800">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-md">
                  <Link2 className="h-5 w-5 text-white" />
                </div>
                URL Credibility & Safety Check
              </CardTitle>
              <CardDescription className="text-base text-gray-600 leading-relaxed">
                Analyze website credibility, check for malicious content, and verify the authenticity of news articles or web pages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Website or Article URL
                </label>
                <Input
                  placeholder="https://example.com/article"
                  value={urlContent}
                  onChange={(e) => setUrlContent(e.target.value)}
                  disabled={loading}
                  className="h-12 border-2 border-gray-200 focus:border-orange-500 focus:ring-orange-200 transition-all duration-200 text-sm"
                />
                <p className="text-xs text-gray-500">Enter the full URL including https:// for complete analysis</p>
              </div>
              <Button
                onClick={() => verifyContent('url', undefined, urlContent)}
                disabled={loading || !urlContent.trim()}
                className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 text-sm font-medium"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Checking URL...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5" />
                    <span>Check URL Safety</span>
                  </div>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {result && (
        <Card className="relative overflow-hidden border-0 bg-white/90 backdrop-blur-sm shadow-2xl mt-8">
          <div className={`absolute top-0 left-0 w-full h-2 ${result.is_fake ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-green-500 to-emerald-500'}`}></div>
          <CardHeader className="pb-6">
            <CardTitle className="flex items-center justify-between text-xl">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-lg ${result.is_fake ? 'bg-gradient-to-br from-red-500 to-orange-600' : 'bg-gradient-to-br from-green-500 to-emerald-600'}`}>
                  {result.is_fake ? (
                    <AlertTriangle className="h-6 w-6 text-white" />
                  ) : (
                    <CheckCircle2 className="h-6 w-6 text-white" />
                  )}
                </div>
                <span className="text-gray-800">Verification Results</span>
              </div>
              {result.is_fake ? (
                <Badge className="text-base px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-lg">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Potentially Fake
                </Badge>
              ) : (
                <Badge className="text-base px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Appears Authentic
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-base">
              <div className="flex items-center gap-2 mt-2">
                <span className="text-gray-600">Confidence Score:</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${result.confidence_score >= 70 ? 'bg-gradient-to-r from-green-500 to-emerald-500' : result.confidence_score >= 40 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-gradient-to-r from-red-500 to-red-600'}`}
                      style={{width: `${result.confidence_score}%`}}
                    ></div>
                  </div>
                  <span className="font-semibold text-gray-800">{result.confidence_score}%</span>
                </div>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Content Restriction Warning - Highest Priority */}
            {result.detected_issues.some(issue => 
              issue.toLowerCase().includes('violence') || 
              issue.toLowerCase().includes('protest') || 
              issue.toLowerCase().includes('blood') || 
              issue.toLowerCase().includes('gore') ||
              issue.toLowerCase().includes('racism') ||
              issue.toLowerCase().includes('hate') ||
              issue.toLowerCase().includes('weapon')
            ) && (
              <Alert className="border-2 border-red-500 bg-gradient-to-r from-red-50 to-orange-50 shadow-lg">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <ShieldAlert className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <AlertDescription className="font-semibold text-base text-red-800">
                      ⛔ CONTENT RESTRICTED
                      <p className="mt-2 font-normal text-sm text-red-700 leading-relaxed">
                        This content contains restricted material including violence, protests, blood, racism, or other harmful content. 
                        <strong className="block mt-2 text-red-800">Not recommended for sharing or distribution.</strong>
                      </p>
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}

            {result.detected_issues.length > 0 && (
              <Alert className={`border-2 shadow-lg ${result.is_fake ? 'border-red-300 bg-gradient-to-r from-red-50 to-orange-50' : 'border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50'}`}>
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ${result.is_fake ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-gradient-to-br from-blue-500 to-indigo-500'}`}>
                    <AlertTriangle className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <AlertDescription>
                      <div className={`font-semibold mb-3 text-base ${result.is_fake ? 'text-red-800' : 'text-blue-800'}`}>Detected Issues:</div>
                      <ul className="space-y-2">
                        {result.detected_issues.map((issue, idx) => {
                          const isRestricted = issue.toLowerCase().includes('violence') || 
                            issue.toLowerCase().includes('protest') || 
                            issue.toLowerCase().includes('blood') || 
                            issue.toLowerCase().includes('gore') ||
                            issue.toLowerCase().includes('racism') ||
                            issue.toLowerCase().includes('hate') ||
                            issue.toLowerCase().includes('weapon');
                          
                          return (
                            <li key={idx} className={`flex items-center gap-2 text-sm ${isRestricted ? "text-red-700 font-semibold" : result.is_fake ? "text-red-600" : "text-blue-600"}`}>
                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isRestricted ? "bg-red-500" : result.is_fake ? "bg-red-400" : "bg-blue-400"}`}></div>
                              {isRestricted && "⚠️ "}{issue}
                            </li>
                          );
                        })}
                      </ul>
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                    <FileText className="h-3 w-3 text-white" />
                  </div>
                  Analysis Summary
                </h3>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-gray-700 leading-relaxed text-sm">
                    {result.analysis_result.analysis_summary}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                    <CheckCircle2 className="h-3 w-3 text-white" />
                  </div>
                  Recommendations
                </h3>
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-100">
                  <p className="text-gray-700 leading-relaxed text-sm">
                    {result.analysis_result.recommendations}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                <span>Analyzed: {new Date(result.created_at).toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FakeBuster;