import { ImageResponse } from 'next/og'

export const alt = 'Dora database explorer'
export const size = {
    width: 1200,
    height: 630
}
export const contentType = 'image/png'

export default async function OgImage() {
    const mascotImage = new URL(
        './dora-backgroundless.png',
        import.meta.url
    ).toString()
    const [monoRegular, monoMedium, monoBold] = await Promise.all([
        fetch(
            new URL('./fonts/NotoSansMono-Regular.ttf', import.meta.url)
        ).then((response) => response.arrayBuffer()),
        fetch(new URL('./fonts/NotoSansMono-Medium.ttf', import.meta.url)).then(
            (response) => response.arrayBuffer()
        ),
        fetch(new URL('./fonts/NotoSansMono-Bold.ttf', import.meta.url)).then(
            (response) => response.arrayBuffer()
        )
    ])

    return new ImageResponse(
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                position: 'relative',
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#060507',
                backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(rgba(255,146,190,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,146,190,0.045) 1px, transparent 1px)',
                backgroundPosition: '0 0, 0 0, 0 0, 0 0',
                backgroundSize:
                    '22px 22px, 22px 22px, 110px 110px, 110px 110px',
                color: '#f8f8f8',
                fontFamily: 'Noto Sans Mono'
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                        'radial-gradient(circle at 58% 50%, transparent 0%, rgba(6,5,7,0.24) 34%, rgba(6,5,7,0.82) 86%), linear-gradient(90deg, rgba(6,5,7,0.34), transparent 34%, rgba(6,5,7,0.42))'
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                        'radial-gradient(circle at 78% 42%, rgba(255,108,170,0.44), transparent 28%), radial-gradient(circle at 56% 67%, rgba(99,255,216,0.16), transparent 24%), radial-gradient(circle at 16% 20%, rgba(255,255,255,0.12), transparent 24%), linear-gradient(135deg, rgba(255,255,255,0.08), transparent 32%, transparent 70%, rgba(255,118,175,0.1))'
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    inset: 48,
                    border: '1px solid rgba(255,204,224,0.16)',
                    borderRadius: 28,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)'
                }}
            />
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '78px 76px 70px 86px'
                }}
            >
                <div
                    style={{
                        width: 470,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 22
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14
                        }}
                    >
                        <div
                            style={{
                                width: 16,
                                height: 16,
                                borderRadius: 999,
                                background: '#ff7bb6',
                                boxShadow: '0 0 32px rgba(255,123,182,0.8)'
                            }}
                        />
                        <div
                            style={{
                                color: 'rgba(255,255,255,0.72)',
                                fontSize: 19,
                                fontWeight: 500
                            }}
                        >
                            doradb.app
                        </div>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10
                        }}
                    >
                        <div
                            style={{
                                fontSize: 90,
                                fontWeight: 700,
                                lineHeight: 1,
                                letterSpacing: 0
                            }}
                        >
                            Dora
                        </div>
                        <div
                            style={{
                                color: 'rgba(255,255,255,0.84)',
                                display: 'flex',
                                flexDirection: 'column',
                                fontSize: 27,
                                fontWeight: 400,
                                lineHeight: 1.22,
                                letterSpacing: 0
                            }}
                        >
                            <span>The database explorer</span>
                            <span>for developers</span>
                        </div>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            gap: 12,
                            paddingTop: 4
                        }}
                    >
                        {['Postgres', 'SQLite', 'MySQL', 'LibSQL'].map(
                            (label) => (
                                <div
                                    key={label}
                                    style={{
                                        border: '1px solid rgba(255,204,224,0.2)',
                                        borderRadius: 999,
                                        background: 'rgba(255,255,255,0.055)',
                                        color: 'rgba(255,255,255,0.76)',
                                        fontSize: 18,
                                        fontWeight: 500,
                                        padding: '10px 16px'
                                    }}
                                >
                                    {label}
                                </div>
                            )
                        )}
                    </div>
                    <div
                        style={{
                            width: 430,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 16,
                            background:
                                'linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,123,182,0.08))',
                            color: 'rgba(255,255,255,0.82)',
                            fontSize: 17,
                            fontWeight: 500,
                            padding: '14px 17px'
                        }}
                    >
                        <span style={{ color: '#ff7bb6' }}>{'>'}</span>
                        <span>select * from products limit 100</span>
                    </div>
                </div>
                <div
                    style={{
                        position: 'relative',
                        width: 560,
                        height: 426,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            right: 10,
                            top: 10,
                            width: 510,
                            height: 338,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            border: '1px solid rgba(255,204,224,0.18)',
                            borderRadius: 22,
                            background:
                                'linear-gradient(180deg, rgba(25,20,27,0.95), rgba(10,8,12,0.96))',
                            boxShadow:
                                '0 30px 90px rgba(0,0,0,0.58), 0 0 80px rgba(255,123,182,0.13)'
                        }}
                    >
                        <div
                            style={{
                                height: 46,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom:
                                    '1px solid rgba(255,255,255,0.09)',
                                padding: '0 16px'
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                }}
                            >
                                {['#ff7bb6', '#ffd166', '#63ffd8'].map(
                                    (color) => (
                                        <span
                                            key={color}
                                            style={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: 999,
                                                background: color
                                            }}
                                        />
                                    )
                                )}
                            </div>
                            <div
                                style={{
                                    color: 'rgba(255,255,255,0.55)',
                                    fontSize: 13,
                                    fontWeight: 500
                                }}
                            >
                                postgres / public
                            </div>
                        </div>
                        <div
                            style={{
                                flex: 1,
                                display: 'flex'
                            }}
                        >
                            <div
                                style={{
                                    width: 132,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 9,
                                    borderRight:
                                        '1px solid rgba(255,255,255,0.08)',
                                    padding: '18px 12px'
                                }}
                            >
                                {['users', 'orders', 'products', 'events'].map(
                                    (label, index) => (
                                        <div
                                            key={label}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                border:
                                                    index === 2
                                                        ? '1px solid rgba(255,123,182,0.32)'
                                                        : '1px solid transparent',
                                                borderRadius: 10,
                                                background:
                                                    index === 2
                                                        ? 'rgba(255,123,182,0.12)'
                                                        : 'rgba(255,255,255,0.035)',
                                                color:
                                                    index === 2
                                                        ? '#ffd5e6'
                                                        : 'rgba(255,255,255,0.56)',
                                                fontSize: 13,
                                                fontWeight: 500,
                                                padding: '9px 10px'
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: 7,
                                                    height: 7,
                                                    borderRadius: 999,
                                                    background:
                                                        index === 2
                                                            ? '#ff7bb6'
                                                            : 'rgba(255,255,255,0.26)'
                                                }}
                                            />
                                            <span>{label}</span>
                                        </div>
                                    )
                                )}
                            </div>
                            <div
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    padding: '18px 16px',
                                    gap: 12
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div
                                        style={{
                                            color: '#ffffff',
                                            fontSize: 16,
                                            fontWeight: 700
                                        }}
                                    >
                                        products
                                    </div>
                                    <div
                                        style={{
                                            border: '1px solid rgba(99,255,216,0.22)',
                                            borderRadius: 999,
                                            color: '#9dffeb',
                                            fontSize: 12,
                                            fontWeight: 500,
                                            padding: '5px 9px'
                                        }}
                                    >
                                        42,819 rows
                                    </div>
                                </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        overflow: 'hidden',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 13
                                    }}
                                >
                                    {[
                                        ['id', 'name', 'price'],
                                        ['1042', 'Starter', '$19'],
                                        ['1043', 'Scale', '$79'],
                                        ['1044', 'Enterprise', '$249'],
                                        ['1045', 'Usage', '$0.08']
                                    ].map((row, rowIndex) => (
                                        <div
                                            key={row.join('-')}
                                            style={{
                                                height:
                                                    rowIndex === 0 ? 34 : 38,
                                                display: 'flex',
                                                alignItems: 'center',
                                                borderTop:
                                                    rowIndex === 0
                                                        ? '0 solid transparent'
                                                        : '1px solid rgba(255,255,255,0.07)',
                                                background:
                                                    rowIndex === 0
                                                        ? 'rgba(255,255,255,0.06)'
                                                        : rowIndex === 2
                                                          ? 'rgba(255,123,182,0.08)'
                                                          : 'rgba(255,255,255,0.02)'
                                            }}
                                        >
                                            {row.map((cell, cellIndex) => (
                                                <span
                                                    key={cell}
                                                    style={{
                                                        width:
                                                            cellIndex === 1
                                                                ? 150
                                                                : 78,
                                                        color:
                                                            rowIndex === 0
                                                                ? 'rgba(255,255,255,0.46)'
                                                                : cellIndex ===
                                                                    2
                                                                  ? '#9dffeb'
                                                                  : 'rgba(255,255,255,0.72)',
                                                        fontSize:
                                                            rowIndex === 0
                                                                ? 11
                                                                : 13,
                                                        fontWeight:
                                                            rowIndex === 0
                                                                ? 700
                                                                : 500,
                                                        paddingLeft: 14
                                                    }}
                                                >
                                                    {cell}
                                                </span>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: 9
                                    }}
                                >
                                    {['schema', 'query', 'docker'].map(
                                        (label) => (
                                            <span
                                                key={label}
                                                style={{
                                                    border: '1px solid rgba(255,255,255,0.09)',
                                                    borderRadius: 9,
                                                    color: 'rgba(255,255,255,0.54)',
                                                    fontSize: 12,
                                                    fontWeight: 500,
                                                    padding: '7px 9px'
                                                }}
                                            >
                                                {label}
                                            </span>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div
                        style={{
                            position: 'absolute',
                            right: 44,
                            bottom: 6,
                            width: 265,
                            height: 220,
                            borderRadius: 999,
                            background:
                                'radial-gradient(circle, rgba(255,123,182,0.44), rgba(255,123,182,0.14) 48%, transparent 72%)'
                        }}
                    />
                    <img
                        alt=""
                        height={326}
                        src={mascotImage}
                        style={{
                            position: 'absolute',
                            right: 42,
                            bottom: 4,
                            display: 'block',
                            objectFit: 'contain'
                        }}
                        width={242}
                    />
                </div>
            </div>
            <div
                style={{
                    position: 'absolute',
                    left: 86,
                    bottom: 60,
                    color: 'rgba(255,204,224,0.78)',
                    fontSize: 17,
                    fontWeight: 500
                }}
            >
                Docker Manager / Drizzle LSP / Query Runner
            </div>
        </div>,
        {
            ...size,
            fonts: [
                {
                    name: 'Noto Sans Mono',
                    data: monoRegular,
                    weight: 400
                },
                {
                    name: 'Noto Sans Mono',
                    data: monoMedium,
                    weight: 500
                },
                {
                    name: 'Noto Sans Mono',
                    data: monoBold,
                    weight: 700
                }
            ]
        }
    )
}
