import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentType, contentUrl, contentText } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: missing token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    const token = authHeader.replace('Bearer ', '').trim();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('auth.getUser failed:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
    }

    console.log('Analyzing content:', contentType);

    // Build messages for AI
    const messages: any[] = [
      {
        role: 'system',
        content: `You are Content Moderation AI, an AI content safety and truth verification expert. Analyze content for:

CRITICAL - Content Restrictions (highest priority):
1. Violence, blood, gore, or graphic injuries
2. Protest imagery or civil unrest
3. Racism, hate speech, or discriminatory content
4. Weapons or threatening behavior
5. Any content that could incite violence or harm

Additional Analysis:
6. Content Moderation/AI-generated detection
7. Misinformation indicators
8. Source credibility (for URLs/text)
9. Metadata inconsistencies

Provide a detailed analysis with:
- is_fake: boolean (true if content appears fake/manipulated OR contains restricted content)
- confidence_score: 0-100 (how confident you are)
- detected_issues: array of ALL issues found (MUST include "Violence", "Protest Imagery", "Blood/Gore", "Racism", "Hate Speech", "Weapons" etc. when detected)
- analysis_summary: detailed explanation of ALL issues including safety concerns
- recommendations: Clear warning if content contains violence, protests, blood, racism, or other harmful material. State "CONTENT RESTRICTED" prominently.

Be thorough and prioritize safety. Flag ANY potentially harmful content.`
      }
    ];

    if (contentType === 'image' && contentUrl) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze this image for authenticity, Content Moderation, violence, protests, and misinformation.'
          },
          {
            type: 'image_url',
            image_url: { url: contentUrl }
          }
        ]
      });
    } else if (contentType === 'text' || contentType === 'url') {
      messages.push({
        role: 'user',
        content: `Analyze this ${contentType} for misinformation and credibility:\n\n${contentText}`
      });
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "verification_result",
            strict: true,
            schema: {
              type: "object",
              properties: {
                is_fake: { type: "boolean" },
                confidence_score: { type: "number" },
                detected_issues: {
                  type: "array",
                  items: { type: "string" }
                },
                analysis_summary: { type: "string" },
                recommendations: { type: "string" }
              },
              required: ["is_fake", "confidence_score", "detected_issues", "analysis_summary", "recommendations"],
              additionalProperties: false
            }
          }
        }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', aiData);

    const analysisResult = JSON.parse(aiData.choices[0].message.content);

    // Store result in database
    const { data: verificationResult, error: dbError } = await supabase
      .from('verification_results')
      .insert({
        user_id: user.id,
        tenant_id: profile.tenant_id,
        content_type: contentType,
        content_url: contentUrl,
        content_text: contentText,
        analysis_result: analysisResult,
        confidence_score: analysisResult.confidence_score,
        is_fake: analysisResult.is_fake,
        detected_issues: analysisResult.detected_issues
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        result: verificationResult
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in verify-content function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});