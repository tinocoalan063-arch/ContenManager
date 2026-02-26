import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const { data: userData } = await supabase.from('users').select('company_id').eq('id', user.id).single();
        if (!userData) return NextResponse.json({ success: false, error: 'Compañía no encontrada' }, { status: 404 });

        const companyId = userData.company_id;
        const searchParams = request.nextUrl.searchParams;
        const days = parseInt(searchParams.get('days') || '7');

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Fetch logs for the period
        const { data: logs, error } = await supabase
            .from('playback_logs')
            .select(`
                id,
                started_at,
                media_id,
                media:media(name, type)
            `)
            .eq('company_id', companyId)
            .gte('started_at', startDate.toISOString())
            .order('started_at', { ascending: true });

        if (error) throw error;

        // Aggregate by day
        const dailyPlays: Record<string, number> = {};
        const mediaDistribution: Record<string, number> = { image: 0, video: 0, url: 0, widget: 0 };
        const topMedia: Record<string, { name: string, count: number }> = {};

        logs?.forEach(log => {
            const date = new Date(log.started_at).toISOString().split('T')[0];
            dailyPlays[date] = (dailyPlays[date] || 0) + 1;

            const mediaData = Array.isArray(log.media) ? log.media[0] : log.media;
            if (mediaData) {
                const type = mediaData.type;
                mediaDistribution[type] = (mediaDistribution[type] || 0) + 1;

                if (!topMedia[log.media_id]) {
                    topMedia[log.media_id] = { name: mediaData.name, count: 0 };
                }
                topMedia[log.media_id].count++;
            }
        });

        const dailyData = Object.entries(dailyPlays).map(([date, count]) => ({ date, count }));
        const distributionData = Object.entries(mediaDistribution).map(([name, value]) => ({ name, value }));
        const topMediaData = Object.values(topMedia)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return NextResponse.json({
            success: true,
            data: {
                totalPlays: logs?.length || 0,
                dailyData,
                distributionData,
                topMediaData
            }
        });
    } catch (error) {
        console.error('Error fetching analytics summary:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
